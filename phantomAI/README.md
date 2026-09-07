# PhantomAI

A real AI chatbot using a static HTML/CSS/JS frontend and a Vercel serverless API route connected to OpenAI.

## Deploy on Vercel
1. Upload this project to GitHub.
2. Import the repository into Vercel.
3. Add an environment variable named `OPENAI_API_KEY` with your real OpenAI API key.
4. Redeploy.
5. Open your deployment URL.

Never put the API key in frontend files. Browser chat history is stored in localStorage; this starter does not include user accounts or a cloud database.

## Local
```bash
npm install
npm install -g vercel
vercel login
vercel dev
```
Create `.env.local` with:
```env
OPENAI_API_KEY=your_real_key_here
```
