FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./

# Install all dependencies to ensure build scripts (like swagger) work
# We can use npm ci if package-lock.json is consistent, otherwise npm install
RUN npm install

# Copy source
COPY . .

# Build Swagger documentation
RUN npm run build:all-swagger

# Expose the port
EXPOSE 3000

# Start command
CMD ["npm", "start"]
