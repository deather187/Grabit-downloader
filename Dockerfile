FROM node:18

# Install ffmpeg, python3 and pip (yt-dlp dependencies + build tools)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    python-is-python3 \
    && rm -rf /var/lib/apt/lists/*

# Create app directory inside the container
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

# Use omit=dev to avoid installing nodemon or local testing packages that might fail
RUN npm install --omit=dev

# Bundle app source
COPY . .

# Expose the port Railway will use
EXPOSE 3000

# Start the application
CMD [ "npm", "start" ]
