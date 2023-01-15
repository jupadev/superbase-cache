export const readFrom = async (cache: KVNamespace, path: string) => {
  const data = await cache.get(path);
  return data ? JSON.parse(data) : null;
};

export const writeTo = async (
  cache: KVNamespace,
  path: string,
  data: unknown
) => {
  await cache.put(path, JSON.stringify(data));
};
