import { useContext } from '@midwayjs/hooks';

export async function queryData(params: any) {
  const ctx = useContext();
  
  return {
    query: ctx.request.query,
    params,
  };
}