export const config = {
  openai: {
    apiKey: (() => {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("Missing OPENAI_API_KEY environment variable. Please add it to your .env.local file (never commit it).")
      }
      return process.env.OPENAI_API_KEY
    })(),
    model: 'gpt-4o-mini', // Using cost-effective model for parsing
  },
  apis: {
    ncbi: {
      apiKey: process.env.NCBI_API_KEY || 'mock_ncbi_key',
      baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
    },
    crispor: {
      apiKey: process.env.CRISPOR_API_KEY || 'mock_crispor_key',
      baseUrl: 'http://crispor.tefor.net',
    },
  },
} 