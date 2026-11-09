
function setupGen3ApiKey() {
  const props = PropertiesService.getScriptProperties();

  if (props.getProperty("GEN3_API_KEY")) {
    throw new Error("API 金鑰已存在，為安全起見不覆蓋");
  }

  const bytes = [];

  for (let i = 0; i < 8; i++) {
    const uuid = Utilities.getUuid().replace(/-/g, "");
    bytes.push(uuid);
  }

  const apiKey = bytes.join("");

  props.setProperty("GEN3_API_KEY", apiKey);

  console.log("API 金鑰已建立並儲存，請勿公開");
}


// 測試第三代 Google Sheets 資料庫連線
function testGen3DatabaseConnection() {
  const props = PropertiesService.getScriptProperties();

  if (!props.getProperty("GEN3_API_KEY")) {
    throw new Error("找不到 API 金鑰");
  }

  const tabs = [
    "Gen3_Users",
    "Auth_Tokens",
    "Auth_Sessions",
    "Auth_Audit_Logs"
  ];

  tabs.forEach(name => {
    const ws = sheet(name);
    console.log(
      name + "：連線成功，資料列數 " +
      (ws.getLastRow() - 1)
    );
  });

  console.log("iKey Gen3 資料庫讀取測試通過");
}

function testGen3DeployedAPI() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty("GEN3_API_KEY");

  if (!apiKey) {
    throw new Error("找不到 API 金鑰");
  }

  const url = "https://script.google.com/macros/s/AKfycbxAUAPxIydMopaKcKNPJo7n9NR-YIvlq8w9ACivN5YU_WVuoGnSQA2PsLVOhf7FTz3IxQ/exec";

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "text/plain",
    payload: JSON.stringify({
      api_key: apiKey,
      action: "findByEmail",
      payload: {
        email: "ikey-connection-test@example.invalid"
      }
    }),
    followRedirects: true,
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  let data;

  try {
    data = JSON.parse(response.getContentText());
  } catch (error) {
    throw new Error("API 未回傳有效 JSON，HTTP 狀態：" + status);
  }

  if (status !== 200 || data.ok !== true) {
    throw new Error(
      "API 測試失敗：" +
      status + " / " + String(data.error || "UNKNOWN")
    );
  }

  if (data.result !== null) {
    throw new Error("測試帳號查詢結果異常");
  }

  console.log("部署 API HTTP 連線成功");
  console.log("API 金鑰驗證成功");
  console.log("Google Sheets 查詢成功");
  console.log("第二關 API 測試通過");
}


function testGen3ProjectAccessSchema() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty("GEN3_API_KEY");

  if (!apiKey) {
    throw new Error("找不到 GEN3_API_KEY");
  }

  const url =
    "https://script.google.com/macros/s/AKfycbxAUAPxIydMopaKcKNPJo7n9NR-YIvlq8w9ACivN5YU_WVuoGnSQA2PsLVOhf7FTz3IxQ/exec";

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "text/plain",
    payload: JSON.stringify({
      api_key: apiKey,
      action: "db.schema",
      payload: {
        table: "Project_Access"
      }
    }),
    followRedirects: true,
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const data = JSON.parse(response.getContentText());

  if (status !== 200 || data.ok !== true) {
    throw new Error(
      "Project_Access API 驗證失敗：" +
      status + " / " +
      String(data.error || "UNKNOWN")
    );
  }

  const schema = data.result;
  const required = [
    "entry_id",
    "project_id",
    "entry_type",
    "user_id",
    "role",
    "status",
    "invite_hash",
    "join_policy",
    "created_at",
    "updated_at",
    "reviewed_by"
  ];

  const missing = required.filter(
    column => !schema.columns.includes(column)
  );

  if (missing.length > 0) {
    throw new Error(
      "Project_Access 缺少欄位：" + missing.join(", ")
    );
  }

  console.log("PASS：Project_Access API 連線");
  console.log("PASS：11 個必要欄位");
  console.log("Project_Access 正式部署驗收通過");
}

function testGen3DeployedProjectAccess() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty("GEN3_API_KEY");

  if (!apiKey) {
    throw new Error("找不到 GEN3_API_KEY");
  }

  const url =
    "https://script.google.com/macros/s/AKfycbxAUAPxIydMopaKcKNPJo7n9NR-YIvlq8w9ACivN5YU_WVuoGnSQA2PsLVOhf7FTz3IxQ/exec";

  const report = {};

  function callAPI(action, payload) {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "text/plain",
      payload: JSON.stringify({
        api_key: apiKey,
        action: action,
        payload: payload
      }),
      followRedirects: true,
      muteHttpExceptions: true
    });

    const status = response.getResponseCode();
    let data;

    try {
      data = JSON.parse(response.getContentText());
    } catch (err) {
      throw new Error(
        action + ": INVALID_JSON / HTTP " + status
      );
    }

    if (status !== 200) {
      throw new Error(action + ": HTTP " + status);
    }

    return data;
  }

  // 1. 正式 API 健康檢查
  const health = callAPI("db.health", {});

  if (
    health.ok !== true ||
    !health.result ||
    health.result.ready !== true
  ) {
    throw new Error("db.health 驗證失敗");
  }

  report.database_health = "PASS";

  // 2. 通用 API 必須拒絕 Project_Access
  const denied = callAPI("db.schema", {
    table: "Project_Access"
  });

  if (
    denied.ok !== false ||
    denied.error !== "DB_TABLE_DENIED"
  ) {
    throw new Error(
      "SECURITY_FAILURE: Project_Access 未被正確保護"
    );
  }

  report.generic_access_denied = "PASS";

  // 3. 專用路由必須拒絕無效身分
  const invalidActor = callAPI("projectAccessMine", {
    actor_user_id: "invalid-test-actor"
  });

  if (
    invalidActor.ok !== false ||
    invalidActor.error !== "ACTOR_INVALID"
  ) {
    throw new Error(
      "專用路由驗證失敗：" +
      String(invalidActor.error || "UNEXPECTED_RESPONSE")
    );
  }

  report.invalid_actor_rejected = "PASS";

  report.passed = true;

  console.log(JSON.stringify(report, null, 2));
  console.log("Gen3 V14 正式專案權限 API 驗收通過");

  return report;
}


