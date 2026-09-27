# Node.js LTS base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy root files, frontend, and backend packages
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/

# Install backend dependencies
WORKDIR /app/backend
RUN npm ci

# Copy entire project
WORKDIR /app
COPY frontend ./frontend
COPY backend ./backend

# Generate Prisma Client and compile TypeScript
WORKDIR /app/backend
RUN npx prisma generate
RUN npm run build

# Expose server port
EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

# Start production server
CMD ["npm", "start"]
