import { NextResponse } from "next/server";

/**
 * Resposta padrão para todo endpoint ainda não implementado nesta fase de
 * fundação do projeto. Retorna `501 Not Implemented` — status que não faz
 * parte do catálogo de erros de negócio do contrato (seção 1.5), então não
 * usa o envelope `{ error: { code, message } }` oficial: é só um marcador
 * temporário de andaimento, não uma resposta de API real.
 *
 * Remover esta chamada assim que o endpoint for implementado de verdade.
 */
export function stubResponse(routeLabel: string) {
  return NextResponse.json(
    {
      stub: true,
      route: routeLabel,
      message: `Endpoint ainda não implementado: ${routeLabel}. Estrutura pronta, aguardando a etapa de implementação do módulo correspondente.`,
    },
    { status: 501 },
  );
}
