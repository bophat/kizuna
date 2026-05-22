FROM node:20-alpine

WORKDIR /app

COPY website/package*.json ./
RUN npm install

COPY website/ .
COPY shared ./shared

EXPOSE 3000

CMD ["npm", "run", "dev"]
