require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

// Swagger 配置
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Polyglot Scholar API Proxy',
      version: '1.0.0',
      description: 'API documentation for the Polyglot Scholar backend proxy server',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
      },
    ],
  },
  apis: [__filename], // 使用绝对路径，确保 swagger-jsdoc 能正确解析
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// 中间件
app.use(cors());
app.use(express.json());
app.use(compression());

// 速率限制
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP在windowMs内最多可以发送100个请求
  standardHeaders: true,
  legacyHeaders: false,
});

// 应用速率限制到所有API路由
app.use('/api/', apiLimiter);

/**
 * @openapi
 * /api/openai/chat/completions:
 *   post:
 *     summary: Proxy for OpenAI Chat Completions API
 *     description: Forwards requests to the OpenAI Chat Completions API.
 *     tags:
 *       - OpenAI
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               model:
 *                 type: string
 *                 example: gpt-4o
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       example: user
 *                     content:
 *                       type: string
 *                       example: 'Hello, world!'
 *     responses:
 *       '200':
 *         description: A successful response from the OpenAI API.
 *       '401':
 *         description: Unauthorized, API key is missing.
 *       '500':
 *         description: Internal server error.
 */
app.post('/api/openai/chat/completions', async (req, res) => {
  try {
    const { apikey } = req.headers; // 从 headers 中获取 apiKey
    if (!apikey) {
      return res.status(401).json({ 
        success: false,
        error: '缺少API密钥',
        code: 'AUTH_ERROR'
      });
    }

    const startTime = Date.now();
    const { __meta, ...forwardBody } = req.body || {};
    const response = await axios.post('https://api.openai.com/v1/chat/completions', forwardBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apikey}` // 使用从 headers 中获取的 apiKey
      },
      timeout: 120000 // 120秒超时
    });

    const processingTime = (Date.now() - startTime) / 1000;
    
    // 添加处理时间到响应
    const responseData = {
      ...response.data,
      _metadata: {
        processingTime,
        provider: 'openai',
        clientMeta: __meta || null
      }
    };

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('OpenAI API错误:', error.response?.data || error.message);
    
    // 更详细的错误响应
    const errorCode = error.response?.status === 401 ? 'AUTH_ERROR' : 
                     error.response?.status === 429 ? 'RATE_LIMIT_ERROR' :
                     error.code === 'ECONNABORTED' ? 'TIMEOUT_ERROR' : 'API_ERROR';
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message || '服务器错误',
      code: errorCode,
      details: error.response?.data
    });
  }
});

/**
 * @openapi
 * /api/deepseek/chat/completions:
 *   post:
 *     summary: Proxy for DeepSeek Chat Completions API
 *     description: Forwards requests to the DeepSeek Chat Completions API.
 *     tags:
 *       - DeepSeek
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               model:
 *                 type: string
 *                 example: deepseek-chat
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       example: user
 *                     content:
 *                       type: string
 *                       example: 'Hello, world!'
 *     responses:
 *       '200':
 *         description: A successful response from the DeepSeek API.
 *       '401':
 *         description: Unauthorized, API key is missing.
 *       '500':
 *         description: Internal server error.
 */
app.post('/api/deepseek/chat/completions', async (req, res) => {
  try {
    const { apikey } = req.headers; // 从 headers 中获取 apiKey
    if (!apikey) {
      return res.status(401).json({ 
        success: false,
        error: '缺少API密钥',
        code: 'AUTH_ERROR'
      });
    }

    const startTime = Date.now();
    const { __meta, ...forwardBody } = req.body || {};
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', forwardBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apikey}` // 使用从 headers 中获取的 apiKey
      },
      timeout: 120000, // 120秒超时
      maxContentLength: 10 * 1024 * 1024, // 10MB
      maxBodyLength: 10 * 1024 * 1024 // 10MB
    });

    const processingTime = (Date.now() - startTime) / 1000;
    
    // 添加处理时间到响应
    const responseData = {
      ...response.data,
      _metadata: {
        processingTime,
        provider: 'deepseek',
        clientMeta: __meta || null
      }
    };

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('DeepSeek API错误:', error.response?.data || error.message);
    
    // 更详细的错误响应
    const errorCode = error.response?.status === 401 ? 'AUTH_ERROR' : 
                     error.response?.status === 429 ? 'RATE_LIMIT_ERROR' :
                     error.code === 'ECONNABORTED' ? 'TIMEOUT_ERROR' : 'API_ERROR';
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message || '服务器错误',
      code: errorCode,
      details: error.response?.data
    });
  }
});

/**
 * @openapi
 * /api/anthropic/messages:
 *   post:
 *     summary: Proxy for Anthropic Messages API
 *     description: Forwards requests to the Anthropic Messages API.
 *     tags:
 *       - Anthropic
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               model:
 *                 type: string
 *                 example: claude-3-sonnet
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       example: user
 *                     content:
 *                       type: string
 *                       example: 'Hello, world!'
 *     responses:
 *       '200':
 *         description: A successful response from the Anthropic API.
 *       '401':
 *         description: Unauthorized, API key is missing.
 *       '500':
 *         description: Internal server error.
 */
app.post('/api/anthropic/messages', async (req, res) => {
  try {
    const { apikey } = req.headers; // 从 headers 中获取 apiKey
    if (!apikey) {
      return res.status(401).json({ 
        success: false,
        error: '缺少API密钥',
        code: 'AUTH_ERROR'
      });
    }

    const startTime = Date.now();
    const { __meta, ...forwardBody } = req.body || {};
    const response = await axios.post('https://api.anthropic.com/v1/messages', forwardBody, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apikey, // 使用从 headers 中获取的 apiKey
        'anthropic-version': '2023-06-01'
      },
      timeout: 60000 // 60秒超时
    });

    const processingTime = (Date.now() - startTime) / 1000;
    
    // 添加处理时间到响应
    const responseData = {
      ...response.data,
      _metadata: {
        processingTime,
        provider: 'anthropic',
        clientMeta: __meta || null
      }
    };

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Anthropic API错误:', error.response?.data || error.message);
    
    // 更详细的错误响应
    const errorCode = error.response?.status === 401 ? 'AUTH_ERROR' : 
                     error.response?.status === 429 ? 'RATE_LIMIT_ERROR' :
                     error.code === 'ECONNABORTED' ? 'TIMEOUT_ERROR' : 'API_ERROR';
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message || '服务器错误',
      code: errorCode,
      details: error.response?.data
    });
  }
});

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the status of the server.
 *     tags:
 *       - Health
 *     responses:
 *       '200':
 *         description: Server is running.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`API代理服务器运行在端口 ${PORT}`);
});
app.post('/api/openai/chat/stream', async (req, res) => {
  try {
    const { apikey } = req.headers;
    if (!apikey) {
      res.writeHead(401, { 'Content-Type': 'text/event-stream' });
      res.write(`event: error\ndata: ${JSON.stringify({ code: 'AUTH_ERROR', error: '缺少API密钥' })}\n\n`);
      return res.end();
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const { __meta, ...forwardBody } = req.body || {};
    if (__meta) {
      res.write(`event: meta\ndata: ${JSON.stringify({ clientMeta: __meta })}\n\n`);
    }
    forwardBody.stream = true;
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${apikey}`
      },
      body: JSON.stringify(forwardBody)
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      res.write(`event: error\ndata: ${JSON.stringify({ code: 'API_ERROR', error: text })}\n\n`);
      return res.end();
    }
    const reader = upstream.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ code: 'API_ERROR', error: err.message })}\n\n`);
    res.end();
  }
});

app.post('/api/deepseek/chat/stream', async (req, res) => {
  try {
    const { apikey } = req.headers;
    if (!apikey) {
      res.writeHead(401, { 'Content-Type': 'text/event-stream' });
      res.write(`event: error\ndata: ${JSON.stringify({ code: 'AUTH_ERROR', error: '缺少API密钥' })}\n\n`);
      return res.end();
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const { __meta, ...forwardBody } = req.body || {};
    if (__meta) {
      res.write(`event: meta\ndata: ${JSON.stringify({ clientMeta: __meta })}\n\n`);
    }
    forwardBody.stream = true;
    const upstream = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${apikey}`
      },
      body: JSON.stringify(forwardBody)
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      res.write(`event: error\ndata: ${JSON.stringify({ code: 'API_ERROR', error: text })}\n\n`);
      return res.end();
    }
    const reader = upstream.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ code: 'API_ERROR', error: err.message })}\n\n`);
    res.end();
  }
});

app.post('/api/anthropic/messages/stream', async (req, res) => {
  try {
    const { apikey } = req.headers;
    if (!apikey) {
      res.writeHead(401, { 'Content-Type': 'text/event-stream' });
      res.write(`event: error\ndata: ${JSON.stringify({ code: 'AUTH_ERROR', error: '缺少API密钥' })}\n\n`);
      return res.end();
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const { __meta, ...forwardBody } = req.body || {};
    if (__meta) {
      res.write(`event: meta\ndata: ${JSON.stringify({ clientMeta: __meta })}\n\n`);
    }
    forwardBody.stream = true;
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'x-api-key': apikey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(forwardBody)
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      res.write(`event: error\ndata: ${JSON.stringify({ code: 'API_ERROR', error: text })}\n\n`);
      return res.end();
    }
    const reader = upstream.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ code: 'API_ERROR', error: err.message })}\n\n`);
    res.end();
  }
});