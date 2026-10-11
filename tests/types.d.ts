/** 测试用的原始资源导入声明 */
declare module '*.sql?raw' {
  const content: string;
  export default content;
}
