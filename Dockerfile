# doc-client/Dockerfile

FROM node:22-alpine

# Create app directory
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# Next.js dev server port
EXPOSE 3000

# Run dev server, listening on all interfaces
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
