
function iKey_AutoCheck_Routing() {
  const report = {
    check: "iKey Gen3 routing verification",
    time: new Date().toISOString(),
    tests: {},
    passed: false
  };

  function run(name, fn, validate) {
    try {
      const result = fn();
      report.tests[name] = validate(result)
        ? "PASS"
        : "UNEXPECTED_RESULT";
    } catch (err) {
      report.tests[name] =
        "ERROR: " + String(err.message || err);
    }
  }

  // 使用與正式 doPost 相同的資料庫派送函式。
  run(
    "database_health",
    () => ikeyDbDispatch_("db.health", {}),
    r => r && r.ready === true &&
         r.engine === "ikey-db-v1"
  );

  // 唯讀讀取 Projects 的欄位結構。
  run(
    "projects_schema",
    () => ikeyDbDispatch_("db.schema", {
      table: "Projects"
    }),
    r => r &&
         r.table === "Projects" &&
         Array.isArray(r.columns) &&
         r.columns.includes("project_id") &&
         r.columns.includes("project_name")
  );

  // 未知指令必須拒絕，不得執行資料操作。
  run(
    "unknown_action_rejected",
    () => {
      try {
        ikeyDbDispatch_("__invalid_diagnostic_action__", {});
        return "NOT_REJECTED";
      } catch (err) {
        return String(err.message || err);
      }
    },
    r => r === "DB_ACTION_DENIED"
  );

  report.passed =
    Object.values(report.tests).every(
      value => value === "PASS"
    );

  report.note =
    "Editor-level checks only; deployed API not yet verified.";

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}


