export const setup = () => {
  const dummyStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
  global.localStorage = dummyStorage as any;
};
setup();
