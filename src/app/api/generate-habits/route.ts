// src/app/api/generate-habits/route.ts
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { identity } = await req.json();

    if (!identity) {
      return NextResponse.json({ error: 'Identidade é obrigatória' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("ERRO: Variável GEMINI_API_KEY não configurada no .env.local!");
      return NextResponse.json({ error: 'Chave de API em falta no servidor' }, { status: 500 });
    }

    // Inicializa o novo cliente oficial da Google. 
    // Ele apanha a GEMINI_API_KEY automaticamente do ambiente.
    const ai = new GoogleGenAI({});

    const prompt = `Atuas como um especialista em psicologia comportamental e hábitos (estilo James Clear em Hábitos Atómicos). 
    O utilizador definiu a seguinte Identidade Alvo: "${identity}".
    
    Gera uma lista com exatamente 10 micro-hábitos diários baseados na regra do "princípio do 1%". 
    Cada hábito deve ser extremamente específico, acionável e curto (máximo 60 caracteres). 
    Exemplos de formato: "Ler 2 páginas de um livro", "Fazer 10 flexões", "Escrever o plano do dia".

    Responde APENAS com um array JSON puro, sem formatação markdown (sem \`\`\`json), sem textos antes ou depois.
    Formato esperado: ["Hábito 1", "Hábito 2", ..., "Hábito 10"]`;

   // Chamada oficial usando a nova biblioteca e o motor estável gemini-2.5-flash
   const response = await ai.models.generateContent({
    model: "gemini-2.5-flash", // <── MODELO CORRIGIDO E ATIVO PARA PRODUÇÃO
    contents: prompt,
  });

    const aiText = response.text;

    if (!aiText) {
      console.error("A IA não devolveu texto.");
      return NextResponse.json({ error: 'A IA respondeu em branco' }, { status: 500 });
    }

    // Converter a string JSON que a IA enviou num array real do JavaScript
    const habits = JSON.parse(aiText.trim());

    return NextResponse.json({ habits });
  } catch (error: any) {
    console.error('ERRO DETALHADO NA NOVA API DA GOOGLE:', error?.message || error);
    return NextResponse.json({ error: 'Erro ao gerar hábitos com o novo SDK' }, { status: 500 });
  }
}