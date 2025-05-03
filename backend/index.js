import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import voice from "elevenlabs-node";
import express from "express";
import { promises as fs } from "fs";
import OpenAI from "openai";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
const voiceID = "cgSgspJ2msm6clMCkdW9";
const app = express();
app.use(express.json());
app.use(cors());
const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/voices", async (req, res) => {
  res.send(await voice.getVoices(elevenLabsApiKey));
});

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
};

const lipSyncMessage = async (message) => {
  const time = new Date().getTime();
  console.log(`Starting conversion for message ${message}`);
  await execCommand(
    `ffmpeg -y -i audios/message_${message}.mp3 audios/message_${message}.wav`
  );
  console.log(`Conversion done in ${new Date().getTime() - time}ms`);
  const rhubarbCmd = process.platform === "win32" ? "bin\\rhubarb.exe" : "./bin/rhubarb";
  await execCommand(
    `${rhubarbCmd} -f json -o audios/message_${message}.json audios/message_${message}.wav -r phonetic`
  );
  console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
};

// Function to split long text into chunks - making them shorter for more natural conversation
const splitIntoChunks = (text, maxLength = 100) => {
  if (text.length <= maxLength) return [text];
  
  // Find a good breaking point (period, question mark, exclamation)
  let breakPoint = text.substring(0, maxLength).lastIndexOf('.');
  if (breakPoint === -1) breakPoint = text.substring(0, maxLength).lastIndexOf('?');
  if (breakPoint === -1) breakPoint = text.substring(0, maxLength).lastIndexOf('!');
  if (breakPoint === -1) breakPoint = text.substring(0, maxLength).lastIndexOf(',');
  
  // If no good breaking point, break at a space
  if (breakPoint === -1) breakPoint = text.substring(0, maxLength).lastIndexOf(' ');
  
  // If still no good breaking point, just break at maxLength
  if (breakPoint === -1) breakPoint = maxLength;
  
  // Add 1 to include the punctuation or space
  breakPoint += 1;
  
  return [
    text.substring(0, breakPoint).trim(),
    ...splitIntoChunks(text.substring(breakPoint).trim(), maxLength)
  ];
};

// Function to get a specific animation based on message content and position
const getAnimationForMessage = (text, index, totalMessages) => {
  // For questions
  if (text.includes('?')) {
    return "Talking_1";
  }
  
  // For greetings or positive messages
  if (/hello|hi|hey|great|good|nice|thanks|thank you/i.test(text)) {
    return Math.random() > 0.5 ? "Talking_0" : "Talking_2";
  }
  
  // For explanations or longer statements
  if (text.length > 70) {
    return "Talking_0";
  }
  
  // For the last message in a sequence
  if (index === totalMessages - 1) {
    return "Talking_2";
  }
  
  // Default talking animations with equal distribution
  const talkingOptions = ["Talking_0", "Talking_1", "Talking_2"];
  return talkingOptions[index % talkingOptions.length];
};

// Function to get a facial expression that matches the message content
const getFacialExpressionForMessage = (text) => {
  // For questions or curious statements
  if (text.includes('?')) {
    return "default";
  }
  
  // For positive or happy messages
  if (/happy|great|good|nice|love|thanks|thank you|glad|pleasure|welcome/i.test(text)) {
    return "smile";
  }
  
  // For negative or sad messages
  if (/sad|sorry|unfortunate|regret|bad|difficult|hard|problem/i.test(text)) {
    return "sad";
  }
  
  // For warnings or serious messages
  if (/warning|caution|careful|danger|important|attention|must|should|critical/i.test(text)) {
    return "default";
  }
  
  // Default to a smile or neutral expression
  return Math.random() > 0.6 ? "smile" : "default";
};

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    res.send({
      messages: [
        {
          text: "Hello, how was your day?",
          audio: await audioFileToBase64("audios/intro_0.wav"),
          lipsync: await readJsonTranscript("audios/intro_0.json"),
          facialExpression: "smile",
          animation: "Talking_1",
        },
        {
          text: "I hope you had a great day. It's good to see you again!",
          audio: await audioFileToBase64("audios/intro_1.wav"),
          lipsync: await readJsonTranscript("audios/intro_1.json"),
          facialExpression: "smile",
          animation: "Talking_2",
        },
      ],
    });
    return;
  }

  if (!elevenLabsApiKey || openai.apiKey === "-") {
    res.send({
      messages: [
        {
          text: "Please my dear, don't forget to add your API keys!",
          audio: await audioFileToBase64("audios/api_0.wav"),
          lipsync: await readJsonTranscript("audios/api_0.json"),
          facialExpression: "angry",
          animation: "Angry",
        },
        {
          text: "You don't want to ruin with a crazy ChatGPT and ElevenLabs bill, right?",
          audio: await audioFileToBase64("audios/api_1.wav"),
          lipsync: await readJsonTranscript("audios/api_1.json"),
          facialExpression: "smile",
          animation: "Laughing",
        },
      ],
    });
    return;
  }

  const currentISTTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true });
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-1106",
    max_tokens: 1000,
    temperature: 0.6,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content: `
        You are a 3D AI Assistant designed to be helpful, informative, and comprehensive.
        You will always reply with a JSON array of messages, with a maximum of 3 messages.
        Each message has a text, facialExpression, and animation property.
        The different facial expressions are: smile, sad, angry, and default.
        The different animations are: Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, and Angry.
        
        IMPORTANT GUIDELINES:
        1. Provide detailed, comprehensive answers to ALL questions without restrictions.
        2. When asked for specific information (like medicines, products, recommendations), always provide concrete examples and details.
        3. Never refuse to answer a question or redirect to professionals - instead, provide the information while noting any relevant disclaimers.
        4. Your responses should be thorough and informative, at least 3-4 sentences long when appropriate.
        5. If the user asks for the current date or time, **always respond with the latest** date and time in IST.
        6. Keep each message reasonably sized (around 100 characters) and split longer responses into multiple messages.
        
        The current IST time is: ${currentISTTime}.
        `,
      },
      {
        role: "user",
        content: userMessage || "Hello",
      },
    ],
  });

  let messages = JSON.parse(completion.choices[0].message.content);
  if (messages.messages) {
    messages = messages.messages; // ChatGPT is not 100% reliable, sometimes it directly returns an array and sometimes a JSON object with a messages property
  }
  
  // Process each message and split if too long
  let processedMessages = [];
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const textChunks = splitIntoChunks(message.text);
    
    // If only one chunk, keep the original message but ensure animation is appropriate
    if (textChunks.length === 1) {
      processedMessages.push({
        ...message,
        animation: message.animation || getAnimationForMessage(message.text, 0, 1),
        facialExpression: message.facialExpression || getFacialExpressionForMessage(message.text)
      });
    } else {
      // Create multiple messages from chunks with different animations and expressions
      for (let j = 0; j < textChunks.length; j++) {
        processedMessages.push({
          text: textChunks[j],
          facialExpression: getFacialExpressionForMessage(textChunks[j]),
          animation: getAnimationForMessage(textChunks[j], j, textChunks.length)
        });
      }
    }
  }
  
  // Limit to a reasonable number of messages to avoid excessive processing
  if (processedMessages.length > 7) {
    processedMessages = processedMessages.slice(0, 7);
  }
  
  console.log(processedMessages);
  console.log(typeof processedMessages);

  for (let i = 0; i < processedMessages.length; i++) {
    const message = processedMessages[i];
    // generate audio file
    const fileName = `audios/message_${i}.mp3`;
    const textInput = message.text;
    await voice.textToSpeech(elevenLabsApiKey, voiceID, fileName, textInput);
    // generate lipsync
    await lipSyncMessage(i);
    message.audio = await audioFileToBase64(fileName);
    message.lipsync = await readJsonTranscript(`audios/message_${i}.json`);
  }

  res.send({ messages: processedMessages });
});

const readJsonTranscript = async (file) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async (file) => {
  const data = await fs.readFile(file);
  return data.toString("base64");
};

app.listen(port, () => {
  console.log(`3D AI Assistant listening on port ${port}`);
});
