async function test() {
  const prompt = 'Calculate 125 * 48 using calculator tool';
  const res = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2:1b',
      messages: [
        {
          role: 'system',
          content: 'You are an AI agent with access to tools.\nWhen you need to execute a tool, respond with a JSON block:\n```json\n{\n  "tool": "calculator",\n  "input": { "expression": "125 * 48" }\n}\n```\nAvailable tools:\n- calculator: evaluate math {"expression": "..."}\n'
        },
        { role: 'user', content: prompt }
      ],
      stream: false
    })
  });
  const data = await res.json();
  console.log('--- Model Output ---');
  console.log(data.message?.content);
  console.log('--------------------');
}
test();
