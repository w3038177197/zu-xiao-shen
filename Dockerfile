FROM public.ecr.aws/docker/library/node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server

EXPOSE 80
CMD ["npm", "start"]
