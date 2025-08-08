
import { v4 as uuidv4 } from 'uuid';

// Function to generate a random integer between min and max (inclusive)
const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Function to generate a random float between min and max
const getRandomFloat = (min, max) => {
  return Math.random() * (max - min) + min;
};

// Function to generate mock chat messages
const generateMockMessages = (count) => {
  const messages = [];
  for (let i = 0; i < count; i++) {
    messages.push({
      id: uuidv4(),
      text: `This is a mock message ${i + 1}.`,
      sender: i % 2 === 0 ? 'user' : 'agent',
      timestamp: new Date().toISOString(),
    });
  }
  return messages;
};

// Main function to generate mock workspace nodes
export const generateMockData = (count = 1000) => {
  const mockData = [];
  for (let i = 0; i < count; i++) {
    const x = getRandomFloat(-5000, 5000);
    const y = getRandomFloat(-5000, 5000);

    mockData.push({
      id: uuidv4(),
      x,
      y,
      type: 'chat-workspace', // or 'tool-call-compact'
      data: {
        messages: generateMockMessages(getRandomInt(1, 10)),
      },
      workspaceId: uuidv4(),
    });
  }
  return mockData;
};
