import fetch from 'node-fetch'

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST'
}

interface HttpRequest {
  url: string
  method: HttpMethod
  body?: string
  expectedHttpCodeResponse: number
}

export const sendRequest = async ({ url, method, body, expectedHttpCodeResponse }: HttpRequest) => {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }

  const response = await fetch(url, { method, headers, body })

  const jsonResponse = await response.json()

  if (response.status !== expectedHttpCodeResponse) {
    throw new Error(jsonResponse.exception)
  }
  return jsonResponse
}
