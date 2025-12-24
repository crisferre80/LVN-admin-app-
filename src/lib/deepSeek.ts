/*
 * Archivo: src/lib/deepSeek.ts
 * Descripción: Función para interactuar con la API Deep Seek.
 *
 * Nota: Se asume que el endpoint de la API Deep Seek es "https://api.deepseek.com/v1/seek".
 * Reemplaza el endpoint si es diferente.
 */

const DEEP_SEEK_API_KEY = "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";
const DEEP_SEEK_ENDPOINT = "https://api.deepseek.com/v1/seek"; // Endpoint asumido

export async function deepSeek(query: string): Promise<unknown> {
  try {
    const response = await fetch(DEEP_SEEK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEP_SEEK_API_KEY}`
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Deep Seek API error ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error in deepSeek:", error);
    throw error;
  }
}
