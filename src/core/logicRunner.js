async function chayCayQuyetDinh({ nhanh, problem }) {
  if (!nhanh || !nhanh.cayQuyetDinhJson) return { success: false, error: 'Nhánh không có cây quyết định' };

  const cay = nhanh.cayQuyetDinhJson;
  const category = cay.category || nhanh.category || 'general';
  const vars = extractVarsTheoCategory(problem, category);

  logger.debug(`🌳 Cây [${category}] — vars: ${JSON.stringify(vars).slice(0, 200)}`);

  if (!Array.isArray(cay.rules) || cay.rules.length === 0) return { success: false, error: 'Cây không có rules' };

  for (const rule of cay.rules) {
    try {
      const matched = evalCondition(rule.if, vars);
      if (!matched) continue;

      logger.info(`🎯 Cây match rule: "${rule.if}"`);

      const then = rule.then || {};
      const logicType = String(then.logicType || '').toLowerCase();
      const logicValue = then.logicValue || '';
      const outputTpl = then.outputTpl || '';

      const result = await chayLogicVoiVars({ logicType, logicValue, outputTpl, vars, problem });
      if (result.success) return { ...result, vars };
      logger.warn(`Rule match nhưng chạy logic lỗi: ${result.error}`);
    } catch (err) {
      logger.warn(`Rule lỗi "${rule.if}": ${err.message}`);
    }
  }

  return { success: false, error: 'Không rule nào match', vars };
}