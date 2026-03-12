FROM node:18-bullseye-slim

# Install ffmpeg and python3 (yt-dlp dependencies)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Create app directory inside the container
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

# Expose the port Railway will use
EXPOSE 3000

# Start the application
CMD [ "npm", "start" ]
