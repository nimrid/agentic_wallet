import Groq from 'groq-sdk';

export class AgentChat {
  private client: Groq;

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey });
  }

  async chat(message: string): Promise<string> {
    const completion = await this.client.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
      model: 'openai/gpt-oss-20b',
    });

    return completion.choices[0]?.message?.content || '';
  }
}
