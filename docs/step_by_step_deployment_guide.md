# Step-by-Step Cloud Deployment Guide

This guide details the exact steps required to take the **Loyalty Offers AI Agent** (Next.js Frontend + Express/Prisma Backend + PostgreSQL DB) from your local machine to a production cloud environment like AWS, Azure, or GCP.

---

## Step 1: Containerize the Applications (Docker)
Before moving to the cloud, package your apps to run uniformly anywhere.

1. **Create `backend/Dockerfile`**:
   ```dockerfile
   FROM node:24-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY prisma ./prisma
   RUN npx prisma generate
   COPY . .
   EXPOSE 3001
   CMD ["node", "index.js"]
   ```

2. **Create `frontend/Dockerfile`**:
   ```dockerfile
   FROM node:24-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm install
   COPY . .
   RUN npm run build
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

3. **Test Locally**: Build and run both images locally using `docker-compose up` to ensure they map ports 3000 and 3001 correctly.

---

## Step 2: Provision a Managed PostgreSQL Database
Do not run databases in raw containers in production. Use a managed service to handle backups, scaling, and high availability.

1. **Choose a Provider**:
   - **AWS**: Go to **RDS** -> Create Database -> Choose Serverless v2 PostgreSQL.
   - **GCP**: Go to **Cloud SQL** -> Create Instance -> Choose PostgreSQL.
   - **Azure**: Go to **Database for PostgreSQL** -> Create Flexible Server.
2. **Network Security**: Ensure the database is placed in a **Private Subnet** (VPC) and only accepts connections from your Backend's future IP or security group.
3. **Capture the Connection String**: You will get a host URL, username, and password. Construct your Production `DATABASE_URL`:
   `postgresql://username:password@your-cloud-host.rds.amazonaws.com:5432/loyaltydb?schema=public`

---

## Step 3: Run Production Database Migrations
Your cloud database is empty. You must populate the Schema created by Prisma.

1. From your local machine terminal, temporarily export the cloud connection string:
   `export DATABASE_URL="postgresql://...your-cloud-host..."`
2. Apply the schema:
   `cd backend && npx prisma migrate deploy`
3. Check your cloud database console to ensure the `User`, `Offer`, and `AnalyticsEvent` tables are created.

---

## Step 4: Setup Cloud Secret Management
Never hardcode API keys or Database URLs in your Docker images.

1. **Choose a Secrets Manager**:
   - **AWS**: Systems Manager Parameter Store or Secrets Manager.
   - **GCP**: Secret Manager.
   - **Azure**: Key Vault.
2. **Store these Keys**:
   - `OPENAI_API_KEY`: `sk-.....`
   - `DATABASE_URL`: The production DB string from Step 2.

---

## Step 5: Deploy the Containers (Serverless Hosting)
Use a serverless container platform to avoid managing underlying EC2/Compute Engine instances.

### Option A: AWS (Fargate / App Runner)
1. Build and tag your Docker images, then push them to **AWS ECR (Elastic Container Registry)**.
2. Go to **AWS App Runner** (easiest) or **ECS Fargate** (most control).
3. Create two services:
   - **Backend Service**: Points to the Backend ECR image. Expose port `3001`. Map the secrets from Step 4 into Environment Variables.
   - **Frontend Service**: Points to the Frontend ECR image. Expose port `3000`.

### Option B: Google Cloud (Cloud Run)
1. Install `gcloud` CLI.
2. Build and submit your images: `gcloud builds submit --tag gcr.io/your-project/loyalty-backend backend/`
3. Go to **Google Cloud Run** and click **Deploy Container**.
4. Select the backend image, map secrets via Environment Variables, allow unauthenticated HTTP invocations, and deploy. Repeat for the Frontend.

### Option C: Azure (Container Apps)
1. Push images to **Azure Container Registry (ACR)**.
2. Go to **Azure Container Apps** and create two apps mirroring the frontend and backend.
3. Secure the backend app by ensuring it only accepts traffic from the frontend app's VNet IP.

---

## Step 6: Connect Frontend to the Cloud Backend
1. Once the Backend is deployed, the cloud provider (AWS/GCP/Azure) will give you a public URL (e.g., `https://loyalty-backend-xyz123.run.app`).
2. Go back to your `frontend/src/app/page.tsx` and `PrivacySettings.tsx` files in your codebase.
3. Replace the hardcoded `http://localhost:3001` with your new production backend URL.
4. **Rebuild** the frontend Docker image and **re-deploy** the updated frontend container to the cloud.

---

## Step 7: Configure a Custom Domain & SSL
1. Go to your cloud provider's DNS manager (Route53 for AWS, Cloud DNS for GCP).
2. Point your domain (e.g., `loyalty-agent.yourcompany.com`) to the Frontend's Load Balancer / App Service URL.
3. The serverless container services (App Runner, Cloud Run) will automatically provision and manage free TLS/SSL certificates for your domain.

Your PCI/GDPR compliant AI Loyalty Agent is now live in production!
