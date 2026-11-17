/**
 * TWS MotionForge AI — Local Script & Storyboard Engine
 * Brand: Tech With Salman
 * Architecture: 100% Local, Offline, Free
 * 
 * Supports:
 * 1. Local Ollama server (http://127.0.0.1:11434)
 * 2. Local llama.cpp server (http://127.0.0.1:8080)
 * 3. Built-in Offline Template/Rule-based Storyboard Generator (zero requirements)
 */

import http from 'node:http';

/**
 * Checks if a local LLM HTTP endpoint is active.
 */
export async function probeLocalLLM(url = 'http://127.0.0.1:11434/api/tags') {
  return new Promise(resolve => {
    try {
      const u = new URL(url);
      const req = http.request({
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: 'GET',
        timeout: 1000
      }, res => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

/**
 * Calls local Ollama API to generate a script and scene structure.
 */
export async function generateWithOllama(topic, model = 'llama3.2:1b', options = {}) {
  const prompt = `You are a viral YouTube Shorts scriptwriter and stickman animator director for "TWS MotionForge AI".
Create a short, punchy 30-45 second stickman explainer video for the topic: "${topic}".
Output JSON only with this structure:
{
  "title": "Short Catchy Title",
  "hook": "Opening hook sentence",
  "script": "Full voiceover narration text (approx 60-90 words)",
  "shots": [
    { "name": "Hook", "description": "Stickman looks overwhelmed with question marks", "duration": 5 },
    { "name": "Problem", "description": "Stickman falls down comically", "duration": 8 },
    { "name": "Solution", "description": "Lightbulb turns on above stickman", "duration": 10 },
    { "name": "Call to action", "description": "Stickman waves and points forward", "duration": 6 }
  ]
}`;

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ model, prompt, stream: false, format: 'json' });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 11434,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 30000
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(JSON.parse(parsed.response));
        } catch (e) {
          reject(new Error(`Failed to parse Ollama response: ${e.message}`));
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(data);
    req.end();
  });
}

/**
 * Intelligent Rule-Based Storyboard Generator.
 * Works 100% offline without any AI server or GPU required.
 */
export function generateRuleBasedStoryboard(input, { style = 'B1', ratio = '16:9' } = {}) {
  const isRawScript = input.split(/\s+/).length > 25;
  let title = 'TWS MotionForge Project';
  let script = '';

  if (isRawScript) {
    script = input.trim();
    const firstLine = script.split(/[\n.!?]/)[0].trim();
    title = firstLine.length < 50 ? firstLine : 'Animated Story';
  } else {
    // Topic input: generate an engaging explainer script
    const topic = input.trim();
    title = topic.length < 40 ? topic : topic.slice(0, 40) + '...';
    script = `Did you know that ${topic} is changing everything we know? Most people struggle with this every single day without realizing why. But here is the secret that solves it all: when you focus on the core fundamentals, the entire puzzle falls into place. Subscribe for more powerful insights from Tech With Salman!`;
  }

  // Deconstruct script into timed shot beats
  const sentences = script.match(/[^.!?]+[.!?]+/g) || [script];
  const shots = [];

  const actions = [
    { type: 'hook', pose: 'questioning', desc: 'Stick figure wonders with curious gesture', sfx: 'ui-feedback' },
    { type: 'conflict', pose: 'falling_or_tired', desc: 'Character struggles against obstacles', sfx: 'comedy-boing' },
    { type: 'breakthrough', pose: 'lightbulb_eureka', desc: 'Glowing revelation and energetic gesture', sfx: 'whoosh' },
    { type: 'takeaway', pose: 'confident_presenter', desc: 'Direct presentation and key takeaway', sfx: 'prop-handoff' },
    { type: 'cta', pose: 'waving_hero', desc: 'Stick figure waves and invites interaction', sfx: 'ui-transition' }
  ];

  sentences.forEach((sentence, idx) => {
    const act = actions[idx % actions.length];
    const wordCount = sentence.trim().split(/\s+/).length;
    // Average speech rate is ~2.8 words per second
    const estDuration = Math.max(3.0, Math.round((wordCount / 2.8) * 10) / 10);

    shots.push({
      id: `shot_${idx + 1}`,
      beat: act.type,
      text: sentence.trim(),
      description: act.desc,
      suggested_pose: act.pose,
      duration: estDuration,
      sfx_hint: act.sfx
    });
  });

  return {
    title,
    script,
    style,
    ratio,
    shots,
    total_estimated_duration: shots.reduce((sum, s) => sum + s.duration, 0),
    music_recommendation: style === 'B4' ? 'bgm-classic-horror-1' : 'bgm-sneaky-snitch',
    method: 'rule_based_storyboard_generator'
  };
}

/**
 * Unified generation entry point: tries local LLM, falls back to rule-based generator.
 */
export async function createStoryboard(input, options = {}) {
  const hasOllama = await probeLocalLLM('http://127.0.0.1:11434/api/tags');
  if (hasOllama && options.useLLM !== false) {
    try {
      const llmResult = await generateWithOllama(input, options.model || 'llama3.2:1b');
      return { ...llmResult, method: 'ollama_local' };
    } catch {
      // Fallback
    }
  }

  return generateRuleBasedStoryboard(input, options);
}
