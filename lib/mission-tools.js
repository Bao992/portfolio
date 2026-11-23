function countWords(value) {
  return (String(value || "").trim().match(/\b[\w'-]+\b/g) || []).length;
}

function findNumbers(value) {
  return [...new Set((String(value || "").match(/\b\d+(?:\.\d+)?%?\b/g) || []))];
}

function inspectMissionInput({ task, context }) {
  const taskWords = countWords(task);
  const contextWords = countWords(context);
  return {
    tool: "inspect_mission_input",
    status: "COMPLETE",
    taskWords,
    contextWords,
    supportingEvidenceProvided: contextWords > 0,
    numericEvidence: findNumbers(context),
    note: contextWords > 0
      ? "Supporting information was supplied. Treat it as user-provided evidence, not independently verified fact."
      : "No supporting evidence was supplied. Analysis must distinguish hypotheses from established facts."
  };
}

function checkPlanQuality(plan) {
  const text = String(plan || "");
  const required = ["OBJECTIVE", "STEPS", "ASSUMPTIONS", "INFORMATION NEEDED"];
  const lines = text.split(/\r?\n/);
  const sections = {};
  let current = null;

  for (const line of lines) {
    const heading = line.match(/^\s*(OBJECTIVE|STEPS|ASSUMPTIONS|INFORMATION NEEDED)\s*:?\s*(.*)$/i);
    if (heading) {
      current = heading[1].toUpperCase();
      sections[current] = [];
      if (heading[2].trim()) sections[current].push(heading[2].trim());
      continue;
    }
    if (current) sections[current].push(line.trim());
  }

  const missingSections = required.filter((heading) =>
    !sections[heading] || sections[heading].join(" ").trim().length === 0
  );
  const stepLines = (sections.STEPS || []).filter((line) =>
    /^(?:[-*•]|\d+[.)])\s+\S/.test(line)
  );

  return {
    tool: "check_plan_structure",
    status: "COMPLETE",
    wordCount: countWords(text),
    requiredSections: required,
    sectionsFound: required.filter((heading) => sections[heading] && sections[heading].join(" ").trim()),
    missingSections,
    actionItemsFound: stepLines.length,
    passed: missingSections.length === 0 && stepLines.length >= 2,
    validationIssues: [
      ...missingSections.map((heading) => "Missing or empty section: " + heading),
      ...(stepLines.length < 2 ? ["STEPS must contain at least two numbered or bulleted actions."] : [])
    ]
  };
}

function auditAnalysisEvidence({ analysis, task, context }) {
  const source = [task, context].filter(Boolean).join("\n");
  const sourceNumbers = new Set(findNumbers(source));
  const analysisNumbers = findNumbers(analysis);
  const unsupportedNumbers = analysisNumbers.filter(number => !sourceNumbers.has(number));
  return {
    tool: "audit_analysis_evidence",
    status: "COMPLETE",
    numbersFoundInAnalysis: analysisNumbers,
    numbersPresentInInput: [...sourceNumbers],
    unsupportedNumericClaims: unsupportedNumbers,
    passed: unsupportedNumbers.length === 0,
    note: "This deterministic check compares numeric strings only. It does not establish whether non-numeric claims are true."
  };
}

function verifyAgentReports({ plan, analysis, verification, planAudit, evidenceAudit }) {
  const checks = [
    { name: "Plan has required sections", passed: planAudit.passed },
    { name: "Analysis contains no unsupported numeric strings", passed: evidenceAudit.passed },
    { name: "Verifier report is substantive", passed: countWords(verification) >= 45 },
    { name: "Analysis report is substantive", passed: countWords(analysis) >= 60 },
    { name: "Plan report is substantive", passed: countWords(plan) >= 45 }
  ];
  const failed = checks.filter(check => !check.passed);
  return {
    tool: "verify_mission_outputs",
    status: "COMPLETE",
    checks,
    passedCount: checks.length - failed.length,
    totalChecks: checks.length,
    qualityStatus: failed.length === 0 ? "CHECKS_PASSED" : "NEEDS_REVIEW",
    note: "Automated checks assess structure and limited consistency only. They do not prove factual correctness; human review remains required."
  };
}

module.exports = {
  inspectMissionInput,
  checkPlanQuality,
  auditAnalysisEvidence,
  verifyAgentReports
};
