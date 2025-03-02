FROM node:20-slim

# Set the working directory to /app/src
WORKDIR /src

# Copy package.json and package-lock.json to the parent directory
COPY package.json .
COPY package-lock.json* .

# Install dependencies from the parent directory
RUN npm install 

# Copy the entire project
COPY . . 

# Command to run the bot
CMD ["npm", "run", "start"]