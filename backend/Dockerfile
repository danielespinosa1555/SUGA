FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
RUN mkdir -p uploads/justifications
EXPOSE 5000
CMD ["npm", "start"]
