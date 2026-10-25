'use strict';
// Read original ZIP in-browser. Never upload audio bytes to a server.
window.iKeyReadWavZip=async function(file){
 if(!file||file.size>80*1024*1024)throw Error('ZIP 檔案過大（上限 80 MB）');
 const bytes=new Uint8Array(await file.arrayBuffer()),v=new DataView(bytes.buffer),decoder=new TextDecoder('utf-8');
 const u16=i=>v.getUint16(i,true),u32=i=>v.getUint32(i,true);
 let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(u32(i)===0x06054b50){eocd=i;break;}}
 if(eocd<0)throw Error('找不到 ZIP 目錄');
 const count=u16(eocd+10),offset=u32(eocd+16);if(count>200||offset>=bytes.length)throw Error('ZIP 目錄格式不支援');
 let cursor=offset,total=0;const result=new Map();
 for(let i=0;i<count;i++){
  if(cursor+46>bytes.length||u32(cursor)!==0x02014b50)throw Error('ZIP 目錄損壞');
  const flags=u16(cursor+8),method=u16(cursor+10),compressed=u32(cursor+20),uncompressed=u32(cursor+24),n=u16(cursor+28),extra=u16(cursor+30),comment=u16(cursor+32),local=u32(cursor+42);
  if(cursor+46+n+extra+comment>bytes.length)throw Error('ZIP 名稱超出範圍');
  const name=decoder.decode(bytes.subarray(cursor+46,cursor+46+n));cursor+=46+n+extra+comment;
  if(!name.toLowerCase().endsWith('.wav'))continue;
  if(flags&1)throw Error('不支援加密 ZIP');
  if(![0,8].includes(method))throw Error('不支援的 ZIP 壓縮格式');
  if(uncompressed>3*1024*1024||(total+=uncompressed)>35*1024*1024)throw Error('WAV 解壓大小超出限制');
  if(local+30>bytes.length||u32(local)!==0x04034b50)throw Error('ZIP 檔案標頭錯誤');
  const start=local+30+u16(local+26)+u16(local+28);
  if(start+compressed>bytes.length)throw Error('ZIP 音效資料不完整');
  const part=bytes.slice(start,start+compressed);let data;
  if(method===0)data=part;
  else{
   if(typeof DecompressionStream!=='function')throw Error('此瀏覽器不支援 ZIP 解壓，請改選 WAV 檔案');
   const stream=new Blob([part]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
   data=new Uint8Array(await new Response(stream).arrayBuffer());
  }
  if(data.length!==uncompressed||data.length<12||String.fromCharCode(...data.subarray(0,4))!=='RIFF'||String.fromCharCode(...data.subarray(8,12))!=='WAVE')throw Error('WAV 格式或大小不正確：'+name);
  const base=name.split('/').pop();if(result.has(base))throw Error('ZIP 內有重複 WAV：'+base);
  result.set(base,new File([data],base,{type:'audio/wav'}));
 }
 return result;
};
