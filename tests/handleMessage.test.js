jest.mock('../index', () => {
  const original = jest.requireActual('../index');
  return { ...original, sendMessage: jest.fn() };
});

const { handleMessage, sendMessage, memory } = require('../index');

describe('handleMessage', () => {
  beforeEach(() => {
    sendMessage.mockClear();
    for (const key in memory) delete memory[key];
  });

  test('asks for date when missing', async () => {
    await handleMessage('user1', 'hello');
    expect(sendMessage).toHaveBeenCalledWith(
      'user1',
      expect.stringContaining('ngày tổ chức cưới')
    );
  });

  test('asks for location after receiving date', async () => {
    await handleMessage('user2', '10/10/2024');
    expect(sendMessage).toHaveBeenCalledWith(
      'user2',
      expect.stringContaining('địa điểm tổ chức')
    );
  });
});
