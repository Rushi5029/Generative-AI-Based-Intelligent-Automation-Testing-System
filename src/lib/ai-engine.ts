import { v4 as uuidv4 } from 'uuid';
import type { TestCase, AmbiguityIssue, RiskAssessment, TraceabilityEntry, DuplicatePair, CoverageData, AutomationFramework, GeneratedScript } from './types';
import { generateExecutableAutomationScript } from './automation-codegen';

const VAGUE_WORDS = [
  'appropriate', 'adequate', 'reasonable', 'sufficient', 'fast', 'slow',
  'user-friendly', 'intuitive', 'easy', 'simple', 'complex', 'various',
  'several', 'many', 'few', 'some', 'etc', 'and so on', 'as needed',
  'if necessary', 'as appropriate', 'timely', 'quickly', 'efficiently',
  'effectively', 'properly', 'correctly', 'good', 'bad', 'nice', 'better',
  'best', 'optimal', 'normal', 'regular', 'standard', 'typical', 'usual',
  'flexible', 'scalable', 'robust', 'seamless', 'smooth', 'minimal',
  'maximum', 'significant', 'large', 'small', 'approximately', 'roughly',
  'about', 'around', 'nearly', 'almost', 'mostly', 'generally', 'usually',
  'often', 'sometimes', 'may', 'might', 'could', 'should', 'possibly'
];

const SECURITY_KEYWORDS = [
  'authentication', 'authorization', 'password', 'encryption', 'token',
  'session', 'login', 'logout', 'access control', 'permission', 'role',
  'admin', 'security', 'ssl', 'tls', 'https', 'certificate', 'oauth',
  'jwt', 'api key', 'secret', 'credential', 'vulnerability', 'injection',
  'xss', 'csrf', 'sanitize', 'validate', 'firewall', 'audit'
];

const PERFORMANCE_KEYWORDS = [
  'performance', 'speed', 'latency', 'throughput', 'response time',
  'load', 'concurrent', 'scalability', 'cache', 'optimization',
  'bandwidth', 'memory', 'cpu', 'database', 'query', 'index',
  'timeout', 'retry', 'batch', 'async', 'parallel', 'queue'
];

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractRequirements(srsText: string): { id: string; text: string }[] {
  const lines = srsText.split('\n').filter(l => l.trim());
  const requirements: { id: string; text: string }[] = [];
  let reqCounter = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    const reqMatch = trimmed.match(/^(REQ[-_]?\d+|R\d+|FR[-_]?\d+|NFR[-_]?\d+|US[-_]?\d+)[:\s-]*(.*)/i);
    if (reqMatch) {
      requirements.push({ id: reqMatch[1].toUpperCase(), text: reqMatch[2].trim() || trimmed });
    } else if (trimmed.length > 20 && !trimmed.startsWith('#') && !trimmed.startsWith('//')) {
      requirements.push({ id: `REQ-${String(reqCounter).padStart(3, '0')}`, text: trimmed });
      reqCounter++;
    }
  }

  if (requirements.length === 0) {
    requirements.push({ id: 'REQ-001', text: srsText.substring(0, 200) });
  }

  return requirements;
}

function determinePriority(text: string): 'High' | 'Medium' | 'Low' {
  const lower = text.toLowerCase();
  const hasSecurityKw = SECURITY_KEYWORDS.some(kw => lower.includes(kw));
  const hasCriticalWords = ['must', 'critical', 'essential', 'mandatory', 'required', 'shall'].some(w => lower.includes(w));
  const hasHighFreq = ['always', 'every', 'all users', 'real-time', 'immediately'].some(w => lower.includes(w));

  if (hasSecurityKw || hasCriticalWords) return 'High';
  if (hasHighFreq || lower.includes('should') || lower.includes('important')) return 'Medium';
  return 'Low';
}

function calculateRiskScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 20;
  SECURITY_KEYWORDS.forEach(kw => { if (lower.includes(kw)) score += 8; });
  PERFORMANCE_KEYWORDS.forEach(kw => { if (lower.includes(kw)) score += 5; });
  if (lower.includes('database') || lower.includes('data')) score += 10;
  if (lower.includes('payment') || lower.includes('transaction')) score += 15;
  if (lower.includes('user input') || lower.includes('form')) score += 7;
  return Math.min(100, score);
}

export async function generateTestCases(srsText: string): Promise<TestCase[]> {
  await delay(800);
  const requirements = extractRequirements(srsText);
  const testCases: TestCase[] = [];
  let tcCounter = 1;

  for (const req of requirements) {
    const priority = determinePriority(req.text);
    const risk = calculateRiskScore(req.text);
    const lower = req.text.toLowerCase();
    const tags = extractTags(req.text);
    const feature = summarizeFeature(req.text);

    // 1) Happy path / functional
    testCases.push({
      id: uuidv4(),
      testCaseId: `TC-${String(tcCounter++).padStart(3, '0')}`,
      scenario: `Verify ${feature} works with valid inputs (happy path)`,
      preconditions: generatePrecondition(req.text),
      steps: buildAtomicSteps(req.text, 'positive'),
      expectedResults: buildExpected(req.text, 'positive'),
      priority,
      riskScore: risk,
      requirementId: req.id,
      category: 'functional',
      tags,
      createdAt: new Date().toISOString(),
    });

    // 2) Negative / invalid input
    testCases.push({
      id: uuidv4(),
      testCaseId: `TC-${String(tcCounter++).padStart(3, '0')}`,
      scenario: `Verify ${feature} rejects invalid/missing required inputs`,
      preconditions: generatePrecondition(req.text),
      steps: buildAtomicSteps(req.text, 'negative'),
      expectedResults: buildExpected(req.text, 'negative'),
      priority: 'High',
      riskScore: Math.min(100, risk + 10),
      requirementId: req.id,
      category: 'negative',
      tags: [...tags, 'negative'],
      createdAt: new Date().toISOString(),
    });

    // 3) Boundary (always — BVA is industry standard for each requirement)
    testCases.push({
      id: uuidv4(),
      testCaseId: `TC-${String(tcCounter++).padStart(3, '0')}`,
      scenario: `Verify boundary values for ${feature}`,
      preconditions: generatePrecondition(req.text),
      steps: buildAtomicSteps(req.text, 'boundary'),
      expectedResults: buildExpected(req.text, 'boundary'),
      priority: 'Medium',
      riskScore: Math.min(100, risk + 5),
      requirementId: req.id,
      category: 'boundary',
      tags: [...tags, 'boundary', 'bva'],
      createdAt: new Date().toISOString(),
    });

    // 4) Security when relevant
    if (SECURITY_KEYWORDS.some(kw => lower.includes(kw)) || /user|account|data|api|admin|payment/.test(lower)) {
      testCases.push({
        id: uuidv4(),
        testCaseId: `TC-${String(tcCounter++).padStart(3, '0')}`,
        scenario: `Verify security controls for ${feature} (authz / injection / session)`,
        preconditions: 'Security test environment is ready. Valid and unauthorized accounts exist. Proxy/logging enabled.',
        steps: buildAtomicSteps(req.text, 'security'),
        expectedResults: buildExpected(req.text, 'security'),
        priority: 'High',
        riskScore: Math.min(100, risk + 20),
        requirementId: req.id,
        category: 'security',
        tags: [...tags, 'security'],
        createdAt: new Date().toISOString(),
      });
    }
  }

  return testCases;
}

function summarizeFeature(text: string): string {
  const cleaned = text.replace(/^(the system shall|system must|users? (should|must|can)|admin users must)\s+/i, '').trim();
  return cleaned.length > 70 ? `${cleaned.slice(0, 70)}...` : cleaned;
}

function buildExpected(text: string, type: string): string {
  const feature = summarizeFeature(text);
  if (type === 'positive') {
    return `1) ${feature} completes successfully. 2) UI/API returns success indicator. 3) Persisted state matches submitted valid data. 4) No unexpected errors in logs.`;
  }
  if (type === 'negative') {
    return `1) Request/action is rejected. 2) Clear field-level or API error message is shown. 3) No partial/invalid data is persisted. 4) HTTP/status or UI state remains consistent with failure.`;
  }
  if (type === 'boundary') {
    return `1) Min and max valid boundary values are accepted. 2) Just-outside boundary values are rejected with validation errors. 3) System remains stable (no crash).`;
  }
  return `1) Unauthorized/malicious attempts are blocked. 2) No sensitive data leakage. 3) Security event is logged. 4) Session/token integrity preserved.`;
}

function buildAtomicSteps(text: string, type: string): string[] {
  const lower = text.toLowerCase();
  const isLogin = /login|sign.?in|authenticate|credentials/.test(lower);
  const isRegister = /register|sign.?up|create account/.test(lower);
  const isSearch = /search|filter|query/.test(lower);
  const isPayment = /payment|transaction|checkout/.test(lower);
  const isApi = /api|endpoint|rest|jwt|token/.test(lower);

  if (type === 'positive') {
    if (isLogin) {
      return [
        'Navigate to "/login"',
        'Enter valid email "qa.valid@example.com" in the email field',
        'Enter valid password "Valid@12345" in the password field',
        'Click the "Login" button',
        'Verify URL contains "dashboard" or home page is displayed',
        'Verify success indicator or authenticated user menu is visible',
      ];
    }
    if (isRegister) {
      return [
        'Navigate to "/register"',
        'Enter name "QA Tester"',
        'Enter unique email "qa.user+{timestamp}@example.com"',
        'Enter password "Valid@12345"',
        'Click the "Register" / "Sign Up" button',
        'Verify account creation success message is displayed',
      ];
    }
    if (isSearch) {
      return [
        'Navigate to the search page',
        'Enter search query "test"',
        'Click Search / press Enter',
        'Verify results list is displayed',
        'Verify each result is relevant to query "test"',
      ];
    }
    if (isPayment) {
      return [
        'Navigate to checkout/payment page',
        'Enter amount "100"',
        'Enter card number "4111111111111111"',
        'Enter CVV "123"',
        'Click "Pay" / "Submit Payment"',
        'Verify payment success confirmation is displayed',
      ];
    }
    if (isApi) {
      return [
        'Obtain a valid authentication token',
        'Send request to the target API endpoint with valid payload',
        'Verify response status is 2xx',
        'Verify response body contains expected fields',
        'Verify server audit/log entry is created',
      ];
    }
    return [
      'Navigate to the feature under test',
      'Prepare and enter valid test data in all required fields',
      'Click the primary action / Submit button',
      'Verify success message or expected outcome is displayed',
      'Verify persisted data matches input',
    ];
  }

  if (type === 'negative') {
    if (isLogin) {
      return [
        'Navigate to "/login"',
        'Enter email "qa.valid@example.com"',
        'Enter invalid password "wrong"',
        'Click the "Login" button',
        'Verify error message about invalid credentials is displayed',
        'Verify user is not redirected to dashboard',
      ];
    }
    return [
      'Navigate to the feature under test',
      'Leave required fields empty or enter invalid values',
      'Attempt to submit the form / execute the action',
      'Verify validation/error messages are displayed',
      'Verify no invalid data is saved',
    ];
  }

  if (type === 'boundary') {
    if (/password/.test(lower)) {
      return [
        'Navigate to password/input form',
        'Enter password with length just below minimum (e.g. 7 chars if min=8)',
        'Attempt submit and verify rejection',
        'Enter password at exact minimum length with required character classes',
        'Verify acceptance at minimum boundary',
        'Enter excessively long password beyond max length and verify rejection/truncation policy',
      ];
    }
    return [
      'Navigate to the input form',
      'Enter minimum allowed value and submit — verify acceptance',
      'Enter maximum allowed value and submit — verify acceptance',
      'Enter value just below minimum — verify rejection',
      'Enter value just above maximum — verify rejection',
    ];
  }

  // security
  return [
    'Attempt to access the feature without authentication',
    'Verify access is denied (401/403 or login redirect)',
    'Login with a low-privilege user',
    'Attempt to access another user\'s resource / admin action',
    'Submit payload containing XSS/SQL injection strings in input fields',
    'Verify malicious input is rejected or safely encoded and no script executes',
    'Verify security/audit log captures the failed attempt',
  ];
}

function generatePrecondition(text: string): string {
  const lower = text.toLowerCase();
  const conditions: string[] = ['System is accessible and running'];
  if (lower.includes('login') || lower.includes('auth') || lower.includes('user')) conditions.push('User is authenticated with valid credentials');
  if (lower.includes('database') || lower.includes('data')) conditions.push('Test database is populated with required test data');
  if (lower.includes('api') || lower.includes('service')) conditions.push('Backend API services are available and responding');
  if (lower.includes('admin')) conditions.push('User has administrator privileges');
  if (lower.includes('payment') || lower.includes('transaction')) conditions.push('Payment gateway sandbox is configured');
  return conditions.join('. ') + '.';
}

function generateSteps(text: string, type: string): string[] {
  const lower = text.toLowerCase();
  if (type === 'positive') {
    const steps = ['Navigate to the relevant module/page'];
    if (lower.includes('login')) {
      steps.push('Enter valid username in the username field', 'Enter valid password in the password field', 'Click the Login button', 'Verify successful login and redirection to dashboard');
    } else if (lower.includes('form') || lower.includes('input') || lower.includes('enter')) {
      steps.push('Locate the input form', 'Enter valid data in all required fields', 'Review the entered information', 'Submit the form', 'Verify success message and data persistence');
    } else if (lower.includes('search') || lower.includes('filter')) {
      steps.push('Locate the search/filter functionality', 'Enter valid search criteria', 'Execute the search', 'Verify results match the search criteria', 'Verify result count and pagination');
    } else if (lower.includes('report') || lower.includes('export')) {
      steps.push('Navigate to the reports section', 'Select report parameters', 'Generate the report', 'Verify report data accuracy', 'Export and verify file format');
    } else {
      steps.push('Identify the feature under test', 'Prepare valid test data', 'Execute the primary action', 'Verify the expected outcome', 'Validate data integrity');
    }
    return steps;
  } else if (type === 'validation') {
    return [
      'Navigate to the input form',
      'Leave required fields empty and attempt submission',
      'Verify required field validation messages appear',
      'Enter invalid format data (e.g., letters in numeric fields)',
      'Verify format validation messages appear',
      'Enter data exceeding maximum length limits',
      'Verify length validation is enforced',
      'Enter valid data in all fields and submit successfully'
    ];
  } else {
    return [
      'Attempt access without authentication',
      'Verify unauthorized access is blocked with appropriate error',
      'Login with valid credentials',
      'Attempt to access resources beyond assigned permissions',
      'Verify role-based access control is enforced',
      'Test for common vulnerabilities (SQL injection, XSS)',
      'Verify security headers and encryption are in place',
      'Review audit logs for security events'
    ];
  }
}

function extractTags(text: string): string[] {
  const tags: string[] = [];
  const lower = text.toLowerCase();
  if (lower.includes('login') || lower.includes('auth')) tags.push('authentication');
  if (lower.includes('api')) tags.push('api');
  if (lower.includes('ui') || lower.includes('interface') || lower.includes('display')) tags.push('ui');
  if (lower.includes('database') || lower.includes('data')) tags.push('data');
  if (lower.includes('performance') || lower.includes('speed')) tags.push('performance');
  if (lower.includes('payment')) tags.push('payment');
  if (lower.includes('notification') || lower.includes('email') || lower.includes('alert')) tags.push('notification');
  if (tags.length === 0) tags.push('general');
  return tags;
}

export async function detectAmbiguities(srsText: string): Promise<AmbiguityIssue[]> {
  await delay(1000);
  const lines = srsText.split('\n');
  const issues: AmbiguityIssue[] = [];

  lines.forEach((line, idx) => {
    const lower = line.toLowerCase();
    VAGUE_WORDS.forEach(word => {
      if (lower.includes(word)) {
        const existing = issues.find(i => i.lineNumber === idx + 1 && i.phrase === word);
        if (!existing) {
          issues.push({
            id: uuidv4(),
            phrase: word,
            reason: getAmbiguityReason(word),
            suggestion: getAmbiguitySuggestion(word),
            severity: getAmbiguitySeverity(word),
            lineNumber: idx + 1,
          });
        }
      }
    });

    // Check for passive voice
    if (/\b(is|are|was|were|be|been|being)\s+(\w+ed|\w+en)\b/i.test(line)) {
      issues.push({
        id: uuidv4(),
        phrase: 'Passive voice detected',
        reason: 'Passive voice can obscure who is responsible for the action',
        suggestion: 'Rewrite using active voice: "The system shall..." instead of "It is expected that..."',
        severity: 'medium',
        lineNumber: idx + 1,
      });
    }

    // Check for missing quantifiers
    if (/\b(many|several|few|some|various|multiple)\b/i.test(line) && !/\d/.test(line)) {
      issues.push({
        id: uuidv4(),
        phrase: 'Missing specific quantity',
        reason: 'Vague quantifiers make requirements untestable',
        suggestion: 'Replace with specific numbers: "The system shall support at least 100 concurrent users"',
        severity: 'high',
        lineNumber: idx + 1,
      });
    }
  });

  return issues.slice(0, 50);
}

function getAmbiguityReason(word: string): string {
  const reasons: Record<string, string> = {
    'appropriate': 'Subjective term - what is appropriate varies by stakeholder',
    'fast': 'No measurable criteria - define specific response time',
    'user-friendly': 'Subjective UX term - define specific usability criteria',
    'easy': 'Subjective - define specific interaction steps',
    'etc': 'Incomplete specification - all items should be explicitly listed',
    'should': 'Ambiguous obligation - use "shall" for mandatory, "may" for optional',
    'may': 'Unclear if this is a permission or possibility',
    'could': 'Unclear if this is a capability or suggestion',
  };
  return reasons[word] || `The term "${word}" is vague and open to interpretation. Define specific, measurable criteria.`;
}

function getAmbiguitySuggestion(word: string): string {
  const suggestions: Record<string, string> = {
    'appropriate': 'Define specific acceptance criteria with measurable thresholds',
    'fast': 'Specify exact response time: "within 200ms" or "under 2 seconds"',
    'user-friendly': 'Define specific usability metrics: task completion rate, error rate, learnability',
    'easy': 'Specify maximum number of steps or time to complete',
    'etc': 'List all items explicitly. If the list is dynamic, define the pattern.',
    'should': 'Use "shall" for mandatory requirements, "may" for optional features',
    'may': 'Clarify: Is this a permission ("is allowed to") or possibility ("might")?',
    'could': 'Clarify: Is this a required capability or a nice-to-have suggestion?',
  };
  return suggestions[word] || `Replace "${word}" with specific, measurable, and testable criteria.`;
}

function getAmbiguitySeverity(word: string): 'high' | 'medium' | 'low' {
  const highSeverity = ['etc', 'and so on', 'as needed', 'if necessary', 'appropriate'];
  const mediumSeverity = ['should', 'may', 'could', 'might', 'possibly', 'fast', 'slow', 'user-friendly'];
  if (highSeverity.includes(word)) return 'high';
  if (mediumSeverity.includes(word)) return 'medium';
  return 'low';
}

export async function assessRisk(srsText: string, testCases: TestCase[]): Promise<RiskAssessment> {
  await delay(800);
  const lower = srsText.toLowerCase();
  const factors: string[] = [];

  let securityRisk = 15;
  let performanceRisk = 15;
  let functionalRisk = 20;

  SECURITY_KEYWORDS.forEach(kw => {
    if (lower.includes(kw)) { securityRisk += 6; factors.push(`Security keyword detected: ${kw}`); }
  });

  PERFORMANCE_KEYWORDS.forEach(kw => {
    if (lower.includes(kw)) { performanceRisk += 5; factors.push(`Performance concern: ${kw}`); }
  });

  if (lower.includes('payment') || lower.includes('financial')) { securityRisk += 20; factors.push('Financial transactions increase security risk'); }
  if (lower.includes('personal data') || lower.includes('pii') || lower.includes('gdpr')) { securityRisk += 15; factors.push('Personal data handling requires compliance'); }
  if (lower.includes('real-time') || lower.includes('concurrent')) { performanceRisk += 15; factors.push('Real-time/concurrent requirements increase performance risk'); }
  if (lower.includes('third-party') || lower.includes('integration') || lower.includes('external')) { functionalRisk += 15; factors.push('External integrations add functional complexity'); }
  if (lower.includes('migration') || lower.includes('legacy')) { functionalRisk += 12; factors.push('Legacy system interaction increases risk'); }

  const highPriorityCount = testCases.filter(tc => tc.priority === 'High').length;
  if (highPriorityCount > testCases.length * 0.5) { functionalRisk += 10; factors.push('High proportion of critical test cases'); }

  securityRisk = Math.min(100, securityRisk);
  performanceRisk = Math.min(100, performanceRisk);
  functionalRisk = Math.min(100, functionalRisk);
  const overallScore = Math.round((securityRisk * 0.4 + performanceRisk * 0.3 + functionalRisk * 0.3));

  return {
    securityRisk: Math.min(100, securityRisk),
    performanceRisk: Math.min(100, performanceRisk),
    functionalRisk: Math.min(100, functionalRisk),
    overallScore: Math.min(100, overallScore),
    factors: [...new Set(factors)].slice(0, 15),
  };
}

export async function generateTraceabilityMatrix(srsText: string, testCases: TestCase[]): Promise<TraceabilityEntry[]> {
  await delay(600);
  const requirements = extractRequirements(srsText);
  return requirements.map(req => {
    const mappedCases = testCases.filter(tc => tc.requirementId === req.id);
    return {
      requirementId: req.id,
      requirementText: req.text,
      testCaseIds: mappedCases.map(tc => tc.testCaseId),
      coverage: mappedCases.length > 0 ? Math.min(100, mappedCases.length * 33) : 0,
    };
  });
}

export async function detectDuplicates(testCases: TestCase[]): Promise<DuplicatePair[]> {
  await delay(1000);
  const duplicates: DuplicatePair[] = [];

  for (let i = 0; i < testCases.length; i++) {
    for (let j = i + 1; j < testCases.length; j++) {
      const similarity = calculateSimilarity(testCases[i].scenario, testCases[j].scenario);
      if (similarity > 0.6) {
        duplicates.push({
          testCase1Id: testCases[i].testCaseId,
          testCase2Id: testCases[j].testCaseId,
          similarity: Math.round(similarity * 100),
          reason: similarity > 0.85 ? 'Near-identical scenarios' : similarity > 0.7 ? 'Highly similar test objectives' : 'Overlapping test coverage',
        });
      }
    }
  }

  return duplicates;
}

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

export async function calculateCoverage(srsText: string, testCases: TestCase[]): Promise<CoverageData> {
  await delay(500);
  const requirements = extractRequirements(srsText);
  const coveredReqIds = new Set(testCases.filter(tc => tc.isCovered).map(tc => tc.requirementId));
  const missingRequirements = requirements.filter(r => !coveredReqIds.has(r.id)).map(r => r.id);

  const categories = ['functional', 'negative', 'edge', 'security', 'boundary'] as const;
  const categoryBreakdown = categories.map(cat => {
    const count = testCases.filter(tc => tc.category === cat).length;
    return { category: cat, count, percentage: testCases.length > 0 ? Math.round((count / testCases.length) * 100) : 0 };
  }).filter(c => c.count > 0);

  return {
    totalRequirements: requirements.length,
    coveredRequirements: requirements.length - missingRequirements.length,
    coveragePercentage: requirements.length > 0 ? Math.round(((requirements.length - missingRequirements.length) / requirements.length) * 100) : 0,
    missingRequirements,
    categoryBreakdown,
  };
}

export async function generateNegativeTestCases(srsText: string): Promise<TestCase[]> {
  await delay(1200);
  const requirements = extractRequirements(srsText);
  const testCases: TestCase[] = [];
  let tcCounter = 500;

  for (const req of requirements) {
    const lower = req.text.toLowerCase();

    // Boundary test case
    testCases.push({
      id: uuidv4(),
      testCaseId: `TC-${String(tcCounter++).padStart(3, '0')}`,
      scenario: `Boundary value analysis for: ${req.text.substring(0, 60)}`,
      preconditions: 'System is running. Test data with boundary values is prepared.',
      steps: [
        'Identify all input fields related to the requirement',
        'Test with minimum boundary value (min)',
        'Test with minimum boundary - 1 (min-1)',
        'Test with minimum boundary + 1 (min+1)',
        'Test with maximum boundary value (max)',
        'Test with maximum boundary + 1 (max+1)',
        'Test with maximum boundary - 1 (max-1)',
        'Verify system behavior for each boundary condition'
      ],
      expectedResults: 'System accepts values within valid range and rejects values outside boundaries with appropriate error messages.',
      priority: 'Medium',
      riskScore: 45,
      requirementId: req.id,
      category: 'boundary',
      tags: ['boundary', 'negative'],
      createdAt: new Date().toISOString(),
    });

    // Invalid input test case
    testCases.push({
      id: uuidv4(),
      testCaseId: `TC-${String(tcCounter++).padStart(3, '0')}`,
      scenario: `Invalid input handling for: ${req.text.substring(0, 60)}`,
      preconditions: 'System is running. Invalid test data is prepared.',
      steps: [
        'Navigate to the feature under test',
        'Enter null/empty values in required fields',
        'Enter special characters (!@#$%^&*) in text fields',
        'Enter extremely long strings (10000+ characters)',
        'Enter SQL injection patterns (\' OR 1=1 --)',
        'Enter XSS payloads (<script>alert(1)</script>)',
        'Enter negative numbers in positive-only fields',
        'Verify error handling for each invalid input'
      ],
      expectedResults: 'System gracefully handles all invalid inputs. No crashes, no security vulnerabilities exposed. Proper error messages displayed.',
      priority: 'High',
      riskScore: 70,
      requirementId: req.id,
      category: 'negative',
      tags: ['negative', 'security', 'validation'],
      createdAt: new Date().toISOString(),
    });

    // Security edge case
    if (lower.includes('login') || lower.includes('auth') || lower.includes('password') || lower.includes('user')) {
      testCases.push({
        id: uuidv4(),
        testCaseId: `TC-${String(tcCounter++).padStart(3, '0')}`,
        scenario: `Security edge case for: ${req.text.substring(0, 60)}`,
        preconditions: 'Security testing tools are available. Multiple test accounts exist.',
        steps: [
          'Attempt brute force login with multiple incorrect passwords',
          'Test session fixation by reusing old session tokens',
          'Test concurrent sessions from different locations',
          'Attempt privilege escalation by modifying request parameters',
          'Test for information leakage in error messages',
          'Verify account lockout after failed attempts',
          'Test password reset flow for vulnerabilities'
        ],
        expectedResults: 'Account locks after configured failed attempts. Sessions are properly managed. No information leakage. Privilege escalation is prevented.',
        priority: 'High',
        riskScore: 85,
        requirementId: req.id,
        category: 'security',
        tags: ['security', 'edge-case'],
        createdAt: new Date().toISOString(),
      });
    }
  }

  return testCases;
}

export function generateAutomationScript(testCase: TestCase, framework: AutomationFramework): GeneratedScript {
  return generateExecutableAutomationScript(testCase, framework);
}

export function generateAPIEndpoints(): object {
  return {
    version: '1.0.0',
    baseUrl: '/api/v1',
    endpoints: [
      { method: 'POST', path: '/test-cases/generate', description: 'Generate test cases from SRS text', body: { srsText: 'string' }, response: { testCases: 'TestCase[]' } },
      { method: 'POST', path: '/ambiguity/detect', description: 'Detect ambiguities in SRS text', body: { srsText: 'string' }, response: { issues: 'AmbiguityIssue[]' } },
      { method: 'POST', path: '/risk/assess', description: 'Assess risk for requirements', body: { srsText: 'string', testCases: 'TestCase[]' }, response: { assessment: 'RiskAssessment' } },
      { method: 'GET', path: '/test-cases', description: 'Get all test cases', response: { testCases: 'TestCase[]' } },
      { method: 'GET', path: '/test-cases/:id', description: 'Get test case by ID', response: { testCase: 'TestCase' } },
      { method: 'POST', path: '/test-cases/prioritize', description: 'Prioritize test cases', body: { testCases: 'TestCase[]' }, response: { prioritized: 'TestCase[]' } },
      { method: 'POST', path: '/scripts/generate', description: 'Generate automation script', body: { testCaseId: 'string', framework: 'string' }, response: { script: 'GeneratedScript' } },
      { method: 'POST', path: '/traceability/generate', description: 'Generate traceability matrix', body: { srsText: 'string', testCases: 'TestCase[]' }, response: { matrix: 'TraceabilityEntry[]' } },
      { method: 'POST', path: '/duplicates/detect', description: 'Detect duplicate test cases', body: { testCases: 'TestCase[]' }, response: { duplicates: 'DuplicatePair[]' } },
      { method: 'GET', path: '/coverage', description: 'Get test coverage analysis', response: { coverage: 'CoverageData' } },
      { method: 'POST', path: '/negative-cases/generate', description: 'Generate negative & edge cases', body: { srsText: 'string' }, response: { testCases: 'TestCase[]' } },
      { method: 'POST', path: '/webhook/trigger', description: 'Webhook trigger for CI/CD', body: { event: 'string', payload: 'object' }, response: { status: 'string', jobId: 'string' } },
    ],
    webhooks: {
      onTestGenerated: { url: '/webhook/test-generated', payload: { testCases: 'TestCase[]', timestamp: 'string' } },
      onRiskAssessed: { url: '/webhook/risk-assessed', payload: { assessment: 'RiskAssessment', timestamp: 'string' } },
    },
  };
}
