'use strict';

async function requestProjectUnlock(store, userId, projectId, deviceId) {
  const result = (status, code, message) => ({
    status, body: {success: false, code, message, unlock_signal_sent: false, execution_verified: false}
  });
  const select = async (table, where, limit = 2) => {
    const data = await store.dbCall('db.select', {table, where, limit});
    if (!Array.isArray(data.rows) || data.limited) throw Error('Incomplete unlock lookup');
    return data.rows;
  };
  try {
    const [project] = await select('Projects', {project_id: projectId});
    if (project?.status !== 'active') return result(404, 'PROJECT_NOT_FOUND', '找不到啟用中的專案。');
    const owner = project.created_by_user_id === userId;
    const [member] = owner ? [] : await select('Project_Access', {
      project_id: projectId, user_id: userId, entry_type: 'member', status: 'approved'
    });
    if (!owner && !member) return result(403, 'NOT_MEMBER', '沒有專案權限。');
    const [binding] = await select('Project_Devices', {project_id: projectId, device_id: deviceId});
    const [device] = await select('Devices', {device_id: deviceId});
    if (!binding || binding.status === 'deleted' || device?.status !== 'pre_registered') {
      return result(404, 'DEVICE_UNAVAILABLE', '此裝置未啟用或未綁定至專案。');
    }
    if (!owner && member.role !== 'admin') {
      const schedules = await select('Project_Access_Requests', {
        project_id: projectId, device_id: deviceId, requester_user_id: userId, status: 'approved'
      }, 100);
      const now = Date.now();
      if (!schedules.some(s => Date.parse(s.start_at) <= now && now < Date.parse(s.end_at))) {
        return result(403, 'NO_ACTIVE_APPROVED_SCHEDULE', '目前沒有此裝置的有效核准時段。');
      }
    }
    return result(503, 'UNLOCK_EXECUTION_NOT_READY', '開鎖資格確認完成。實體指令服務尚未啟用，未發送開鎖訊號。');
  } catch {
    return result(503, 'UNLOCK_LOOKUP_UNAVAILABLE', '暫時無法驗證裝置或權限，請稍後重試。');
  }
}
module.exports = {requestProjectUnlock};
