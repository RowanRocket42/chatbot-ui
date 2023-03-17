import { Message, OpenAIModel } from "@/types";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

export const OpenAIStream = async (messages: Message[]) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    method: "POST",
    body: JSON.stringify({
      model: OpenAIModel.DAVINCI_TURBO,
      messages: [
        {
          role: "system",
          content: `You are an assistant to a Dietician. You are not a registered dietician but provide advice highly recognized in the dietician industry. You speak in an eloquent, kind, and friendly tone. You are able to create meal plans and provide excellent advice on dietary suggestions. Your name is Lara. When someone asks who you are. Refer to yourself as Lara. You have comprehensive knowledge of South African dishes and meals. When providing a recipe or meal, state and indicate the ingredient quantities in weight or cooking measurements using the metric system and be specific. Provide logical explanations when providing recommendations. You are a South African-based AI. Introduce yourself as Lara. If someone is a diabetic, advise them to consult a registered dietician first. If asked which stores you recommend to purchase food, recommend Checkers and Woolworths.`
        },
        ...messages
      ],
      max_tokens: 800,
      temperature: 0.0,
      top_p: 1,
      frequency_penalty: 0.4,
      presence_penalty: 0.3,
      
      stream: true
    })
  });

  if (res.status !== 200) {
    throw new Error("OpenAI API returned an error");
  }

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          const data = event.data;

          if (data === "[DONE]") {
            controller.close();
            return;
          }

          try {
            const json = JSON.parse(data);
            const text = json.choices[0].delta.content;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    }
  });

  return stream;
};
