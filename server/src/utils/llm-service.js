import axios from 'axios';
import config from '../config/index.js';
import logger from './logger.js';

class LLMService {
  constructor() {
    // Auto-detect provider from available keys if AI_PROVIDER is not explicitly set
    if (config.ai.provider === 'openai' && !config.ai.openai.apiKey && config.ai.gemini.apiKey) {
      this.provider = 'gemini';
      logger.info('AI_PROVIDER auto-detected: using gemini (GEMINI_API_KEY present, no OPENAI_API_KEY)');
    } else {
      this.provider = config.ai.provider;
    }
    // OpenAI client
    this.openaiClient = axios.create({
      baseURL: config.ai.openai.endpoint,
      headers: {
        'Authorization': `Bearer ${config.ai.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    // HuggingFace client
    this.huggingfaceClient = axios.create({
      baseURL: 'https://api-inference.huggingface.co/models',
      headers: {
        'Authorization': `Bearer ${config.ai.huggingface.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    let geminiBase = config.ai.gemini.endpoint || 'https://generativelanguage.googleapis.com/v1beta';
    if (geminiBase.endsWith('/models')) {
      geminiBase = geminiBase.replace('/models', '');
    }
    
    // Gemini client
    this.geminiClient = axios.create({
      baseURL: geminiBase,
      headers: {
        'Content-Type': 'application/json',
      },
      params: {
        key: config.ai.gemini.apiKey,
      },
    });

    if (this.provider === 'gemini') {
      this.validateConfiguration();
    }
  }

  async validateConfiguration() {
    if (!config.ai.gemini.apiKey) {
      logger.error('Startup Error: GEMINI_API_KEY is missing.');
      return;
    }
    const model = config.ai.gemini.model;
    if (!model) {
      logger.error('Startup Error: GEMINI_MODEL is missing.');
      return;
    }

    try {
      const response = await this.geminiClient.get('/models');
      const models = response.data.models || [];
      const modelExists = models.some(m => 
        m.name === `models/${model}` || 
        m.name === model || 
        m.name.includes(model)
      );
      if (modelExists) {
        logger.info(`Startup Validation Success: Model ${model} is available.`);
      } else {
        logger.info(`Gemini Model configured: ${model}`);
      }
    } catch (error) {
      logger.debug(`Startup Validation: Could not fetch models list. ${error.message}`);
    }
  }

  shouldUseMock() {
    return process.env.ENABLE_MOCK_AI === 'true' || 
           (process.env.NODE_ENV === 'development' && !config.ai.gemini.apiKey);
  }

  logDetailedError(error, model, provider) {
    logger.error('--- LLM API Error Details ---');
    logger.error(`Provider: ${provider}`);
    logger.error(`Model: ${model}`);
    
    if (error.response) {
      logger.error(`HTTP Status: ${error.response.status}`);
      logger.error(`API URL: ${error.config?.url || 'Unknown'}`);
      logger.error(`Error Message: ${error.message}`);
      try {
        if (typeof error.response.data === 'string') {
          logger.error(`Google Error Body: ${error.response.data}`);
        } else if (error.response.data && typeof error.response.data === 'object') {
          if (error.response.data.readable || error.response.data._readableState) {
            logger.error(`Google Error Body: [Readable Stream Error]`);
          } else {
            logger.error(`Google Error Body: ${JSON.stringify(error.response.data)}`);
          }
        }
      } catch (e) {
        logger.error(`Google Error Body: [Unserializable Error Object]`);
      }
    } else if (error.request) {
      logger.error(`Error Message: No response received - ${error.message}`);
    } else {
      logger.error(`Error Message: ${error.message}`);
    }
    
    if (error.config && error.config.data && typeof error.config.data === 'string') {
       try {
          const parsed = JSON.parse(error.config.data);
          logger.error(`Request Body: ${JSON.stringify(parsed, null, 2)}`);
       } catch (e) {
          logger.error(`Request Body: ${error.config.data}`);
       }
    }
    
    if (error.stack) {
      logger.error(`Stack Trace: ${error.stack}`);
    }
    logger.error('-----------------------------');
  }

  async checkHealth() {
    const health = {
      provider: this.provider,
      model: config.ai.gemini.model,
      apiConfigured: !!config.ai.gemini.apiKey,
      apiReachable: false,
      sdkVersion: 'REST API via Axios',
      environment: process.env.NODE_ENV || 'development',
      status: 'unhealthy'
    };
    
    if (!health.apiConfigured) {
      health.status = 'API Key missing';
      return health;
    }
    
    try {
      const response = await this.geminiClient.get('/models');
      health.apiReachable = true;
      const models = response.data.models || [];
      const modelExists = models.some(m => m.name === `models/${health.model}` || m.name === health.model);
      if (modelExists) {
        health.status = 'healthy';
      } else {
        health.status = 'model_not_found';
      }
    } catch (error) {
      health.status = 'unreachable';
      health.error = error.message;
    }
    
    return health;
  }

  async generateCompletion(prompt, maxTokens = 2000, options = {}) {
    try {
      const provider = options.provider || this.provider;
      const systemPrompt = options.systemPrompt || 'You are an expert software testing specialist and QA automation engineer.';

      if (provider === 'openai') {
        if (!config.ai.openai.apiKey) {
          logger.warn('OpenAI API key not configured, returning mock response');
          return this.getMockResponse(prompt);
        }
        const response = await this.openaiClient.post('/chat/completions', {
          model: options.model || config.ai.openai.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: typeof options.temperature === 'number' ? options.temperature : config.ai.openai.temperature,
          max_tokens: maxTokens,
        });
        const content = response.data.choices[0].message.content;
        const tokens = response.data.usage;
        logger.info(`AI completion (OpenAI) generated. Tokens used: ${tokens.total}`);
        return { success: true, content, tokens, provider: 'openai' };
      }

      if (provider === 'huggingface') {
        if (!config.ai.huggingface.apiKey) {
          logger.warn('HuggingFace API key not configured, returning mock response');
          return this.getMockResponse(prompt);
        }
        const model = options.model || config.ai.huggingface.model;
        const response = await this.huggingfaceClient.post(`/${model}`, {
          inputs: prompt,
          parameters: { max_new_tokens: maxTokens },
        });
        const content = Array.isArray(response.data)
          ? response.data[0]?.generated_text || ''
          : response.data.generated_text || JSON.stringify(response.data);
        logger.info(`AI completion (HuggingFace) generated.`);
        return { success: true, content, tokens: {}, provider: 'huggingface' };
      }

      if (provider === 'gemini') {
        if (!config.ai.gemini.apiKey && this.shouldUseMock()) {
          logger.warn('Gemini API key not configured, returning mock response');
          return this.getMockResponse(prompt);
        }
        
        if (!config.ai.gemini.apiKey) {
           throw new Error('GEMINI_API_KEY is not configured');
        }

        const model = options.model || config.ai.gemini.model;
        const targetUrl = `/models/${model}:generateContent`;
        
        logger.info(`Sending Gemini Request - Provider: Google, Model: ${model}, Endpoint: ${this.geminiClient.defaults.baseURL}${targetUrl}`);
        
        const requestBody = {
          contents: [
            { role: 'user', parts: [{ text: prompt }] },
          ],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: typeof options.temperature === 'number' ? options.temperature : 0.7,
          },
        };

        // Pass systemPrompt as system_instruction (Gemini API v1beta feature)
        if (systemPrompt) {
          requestBody.system_instruction = {
            parts: [{ text: systemPrompt }],
          };
        }

        const response = await this.geminiClient.post(targetUrl, requestBody);
        const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        logger.info(`AI completion (Gemini) generated successfully.`);
        return { success: true, content, tokens: {}, provider: 'gemini' };
      }

      // Default fallback
      logger.warn('Unknown provider or not configured, using mock response');
      return this.getMockResponse(prompt);
    } catch (error) {
      this.logDetailedError(error, options.model || config.ai.gemini.model, options.provider || this.provider);
      
      // Fallback to mock response gracefully on network/API failure so feature remains workable
      logger.warn(`LLM call failed (${error.response?.status || error.code || error.message}), falling back to intelligent mock engine`);
      return this.getMockResponse(prompt);
    }
  }

  getMockResponse(prompt) {
    logger.info('Using mock LLM response (API not configured)');

    // Detect prompt intent from keywords
    const isChangeImpact = /OLD REQUIREMENT|NEW REQUIREMENT|impactLevel/i.test(prompt);
    const isTestData = /generate.*test data|valid.*invalid.*boundary|five categories|test data/i.test(prompt);
    const isChatbot = /CONVERSATION HISTORY|USER'S LATEST REQUEST|CURRENT TEST CASES \(STATE\)/i.test(prompt);

    if (isChatbot) {
      return this.getMockChatResponse(prompt);
    }

    if (isChangeImpact) {
      return {
        success: true,
        content: JSON.stringify({
          impactLevel: 'Medium',
          reason: 'The requirement change modifies core functionality. Several test cases covering login and authentication may need to be updated.',
          affected: [
            {
              testCaseId: 'TC-001',
              scenario: 'Verify user login with valid credentials',
              impact: 'High',
              reason: 'The updated requirement changes the authentication flow which directly affects this test case.',
              regressionPriority: 'Immediate',
            },
            {
              testCaseId: 'TC-002',
              scenario: 'Verify error message on invalid credentials',
              impact: 'Medium',
              reason: 'Error handling behavior may differ with the new requirement.',
              regressionPriority: 'Next Sprint',
            },
          ],
        }),
        tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        provider: 'mock',
      };
    }

    if (isTestData) {
      return {
        success: true,
        content: JSON.stringify({
          valid: ['user@example.com', 'validPassword123!', 'John Doe', '+1-555-0100', 'https://example.com'],
          invalid: ['notanemail', '123', '', 'a'.repeat(256), 'user@'],
          boundary: ['a@b.co', 'x'.repeat(254) + '@b.co', '1', '2147483647', '0'],
          edge: ['user+tag@example.com', 'user@subdomain.example.co.uk', '   spaces   ', 'NULL', '<script>alert(1)</script>'],
          security: ["' OR '1'='1", '<script>alert(1)</script>', '../../../etc/passwd', 'admin--', '{{7*7}}'],
        }),
        tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        provider: 'mock',
      };
    }

    // Default: test case generation mock
    const requirementMatch = prompt.match(/Requirement:\s*"([^"]+)"/i) || prompt.match(/Requirement:\s*([^.]+)/i);
    const requirement = requirementMatch ? requirementMatch[1] : 'Default functionality';

    const mockTestCases = [
      {
        scenario: `Verify basic ${requirement}`,
        preconditions: ['User is logged in', 'System is accessible'],
        steps: ['Navigate to feature', 'Perform action', 'Verify result'],
        expectedResults: 'Feature works as expected',
        priority: 'High',
        category: 'functional',
      },
      {
        scenario: `Verify ${requirement} with valid inputs`,
        preconditions: ['User is logged in', 'Test data available'],
        steps: ['Input valid data', 'Submit request', 'Verify processing'],
        expectedResults: 'Request processed successfully',
        priority: 'High',
        category: 'functional',
      },
      {
        scenario: `Verify ${requirement} with invalid inputs`,
        preconditions: ['User is logged in'],
        steps: ['Input invalid data', 'Submit request', 'Check error handling'],
        expectedResults: 'Error message displayed, data not processed',
        priority: 'High',
        category: 'negative',
      },
      {
        scenario: `Verify edge case for ${requirement}`,
        preconditions: ['User is logged in', 'Boundary data available'],
        steps: ['Input boundary value', 'Submit request', 'Verify behavior'],
        expectedResults: 'System handles boundary case correctly',
        priority: 'Medium',
        category: 'edge',
      },
      {
        scenario: `Verify security for ${requirement}`,
        preconditions: ['User is logged in'],
        steps: ['Attempt unauthorized access', 'Try to bypass security', 'Verify protection'],
        expectedResults: 'Security measures prevent unauthorized access',
        priority: 'High',
        category: 'security',
      },
    ];

    return {
      success: true,
      content: JSON.stringify(mockTestCases),
      tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      provider: 'mock',
    };
  }

  getMockChatResponse(prompt) {
    // Extract user's latest message from the chat prompt
    const userMsgMatch = prompt.match(/USER'S LATEST REQUEST:\s*"([^"]*)"/i);
    const userMsg = userMsgMatch ? userMsgMatch[1].toLowerCase() : '';
    const hasExistingTestCases = !/CURRENT TEST CASES \(STATE\):\s*\[\s*\]/i.test(prompt);

    // Detect greeting
    if (/^(hi|hello|hey|good morning|good evening|yo|sup|what's up)$/i.test(userMsg.trim())) {
      return {
        success: true,
        content: JSON.stringify({
          intent: 'GREETING',
          reply: 'Hello! 👋 I am your AI QA Assistant. I can help you generate Test Cases, API Tests, Automation Scripts, Boundary Tests, Negative Tests, Security Tests, and Risk Analysis. What would you like to test today?',
          testCases: [],
          save: false,
        }),
        tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        provider: 'mock',
      };
    }

    // Detect thanks/general
    if (/^(thanks|thank you|ok|okay|got it|great|cool|awesome|nice)$/i.test(userMsg.trim())) {
      return {
        success: true,
        content: JSON.stringify({
          intent: 'GENERAL_CHAT',
          reply: 'You\'re welcome! Let me know if you need help with anything else — I can generate more test cases, add negative/security tests, or refine existing ones.',
          testCases: [],
          save: false,
        }),
        tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        provider: 'mock',
      };
    }

    // Detect help
    if (/help|what can you do|capabilities/i.test(userMsg)) {
      return {
        success: true,
        content: JSON.stringify({
          intent: 'HELP',
          reply: 'I can help you with:\n\n🧪 **Generate Test Cases** — Describe a feature and I\'ll create comprehensive test cases\n🔒 **Security Tests** — Add security-focused test scenarios\n❌ **Negative Tests** — Generate failure/error test cases\n📏 **Boundary Tests** — Create boundary value analysis tests\n🤖 **Automation Scripts** — Generate automation code\n📊 **API Tests** — Create API testing scenarios\n\nJust describe what you want to test!',
          testCases: [],
          save: false,
        }),
        tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        provider: 'mock',
      };
    }

    // Default: generate test cases for the described feature
    const feature = userMsg.replace(/generate|test cases?|for|please|create|add/gi, '').trim() || 'user login';
    return {
      success: true,
      content: JSON.stringify({
        intent: hasExistingTestCases ? 'REFINE_TESTCASE' : 'NEW_TESTCASE',
        reply: `I've generated comprehensive test cases for "${feature}". The cases cover functional, negative, boundary, and security scenarios. You can ask me to refine them, add more specific test types, or save them to your project.`,
        testCases: [
          {
            scenario: `Verify ${feature} works with valid inputs`,
            preconditions: ['User is authenticated', 'System is in a stable state', 'Required data is available'],
            steps: [`Navigate to the ${feature} section`, 'Enter valid input data', 'Submit the form/request', 'Observe the system response'],
            expectedResults: `The ${feature} completes successfully and the expected outcome is displayed`,
            priority: 'High',
            category: 'functional',
          },
          {
            scenario: `Verify ${feature} handles invalid inputs gracefully`,
            preconditions: ['User is authenticated', 'System is in a stable state'],
            steps: [`Navigate to the ${feature} section`, 'Enter invalid/malformed input data', 'Attempt to submit', 'Observe error handling'],
            expectedResults: 'Appropriate error message is displayed without system crash',
            priority: 'High',
            category: 'negative',
          },
          {
            scenario: `Verify ${feature} boundary values`,
            preconditions: ['User is authenticated', 'Boundary test data prepared'],
            steps: [`Navigate to the ${feature} section`, 'Enter minimum boundary value and submit', 'Enter maximum boundary value and submit', 'Enter values just outside valid range'],
            expectedResults: 'System accepts valid boundary values and rejects out-of-range values',
            priority: 'Medium',
            category: 'boundary',
          },
          {
            scenario: `Verify ${feature} is secure against common attacks`,
            preconditions: ['User is authenticated', 'Security testing tools available'],
            steps: ['Attempt SQL injection in input fields', 'Attempt XSS script injection', 'Test with excessively long input strings', 'Verify proper input sanitization'],
            expectedResults: 'All malicious inputs are rejected or sanitized, no security vulnerabilities exposed',
            priority: 'High',
            category: 'security',
          },
          {
            scenario: `Verify ${feature} performance under load`,
            preconditions: ['Performance testing environment set up', 'Monitoring tools configured'],
            steps: ['Execute the feature with normal load', 'Increase concurrent users gradually', 'Monitor response times', 'Check for degradation'],
            expectedResults: 'Response time remains within acceptable limits under expected load',
            priority: 'Medium',
            category: 'performance',
          },
        ],
        save: false,
      }),
      tokens: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      provider: 'mock',
    };
  }

  /**
   * Stream completion via Gemini's streamGenerateContent endpoint.
   * Yields text chunks as they arrive. Falls back to non-streaming if unsupported.
   */
  async *generateCompletionStream(prompt, maxTokens = 2000, options = {}) {
    const provider = options.provider || this.provider;
    const systemPrompt = options.systemPrompt || 'You are an expert software testing specialist and QA automation engineer.';

    if (provider !== 'gemini' || !config.ai.gemini.apiKey) {
      // Fallback: yield full response at once
      const result = await this.generateCompletion(prompt, maxTokens, options);
      yield result.content;
      return;
    }

    const model = options.model || config.ai.gemini.model;
    const targetUrl = `/models/${model}:streamGenerateContent?alt=sse`;

    logger.info(`Streaming Gemini Request - Model: ${model}`);

    const requestBody = {
      contents: [
        { role: 'user', parts: [{ text: prompt }] },
      ],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: typeof options.temperature === 'number' ? options.temperature : 0.7,
      },
    };

    if (systemPrompt) {
      requestBody.system_instruction = {
        parts: [{ text: systemPrompt }],
      };
    }

    try {
      const response = await this.geminiClient.post(targetUrl, requestBody, {
        responseType: 'stream',
        timeout: 120000,
      });

      let buffer = '';
      for await (const chunk of response.data) {
        buffer += chunk.toString();
        // SSE format: lines starting with "data: "
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (text) yield text;
            } catch {
              // skip malformed chunk
            }
          }
        }
      }
      // Process remaining buffer
      if (buffer.startsWith('data: ')) {
        const jsonStr = buffer.slice(6).trim();
        if (jsonStr && jsonStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(jsonStr);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) yield text;
          } catch {
            // skip
          }
        }
      }
    } catch (error) {
      this.logDetailedError(error, model, 'gemini-stream');
      try {
        const result = await this.generateCompletion(prompt, maxTokens, options);
        yield result.content;
      } catch (fallbackErr) {
        logger.warn(`Stream fallback error: ${fallbackErr.message}`);
        const mockResult = this.getMockResponse(prompt);
        yield mockResult.content;
      }
    }
  }

  async parseJSON(text) {
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error(`JSON parsing error: ${error.message}`);
      throw error;
    }
  }
}

export default new LLMService();
