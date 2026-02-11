export const buildResponse = async (
  res: any,
  statusCode: number,
  success: boolean,
  message: string,
  error: any,
  data: any,
) => {
  return res?.status(statusCode).json({
    success: success,
    message: message,
    error: error,
    data: data,
  });
};
