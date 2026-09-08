import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MagicTreeStage } from './MagicTreeStage';

const create = vi.hoisted(() => vi.fn());
vi.mock('./magic-tree-stage', () => ({ createMagicTreeStage: create }));
const stage = () => ({ destroy: vi.fn(), setQr: vi.fn() });
afterEach(() => { cleanup(); create.mockReset(); });

describe('MagicTreeStage', () => {
  it('supports repeated keyboard toggles with the tree as the default view', async () => {
    const instance = stage(); create.mockResolvedValue(instance);
    const user = userEvent.setup();
    render(<MagicTreeStage imageUrl="blob:qr" />);
    const button = await screen.findByRole('button', { name: '俯视查看二维码' });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(document.querySelector('.magic-tree-stage__controls')).toBeNull();
    button.focus(); await user.keyboard('{Enter}');
    expect(instance.setQr).toHaveBeenLastCalledWith(true);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    await user.keyboard(' ');
    expect(instance.setQr).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText('显示原始二维码')).not.toBeInTheDocument();
  });
  it('destroys scenes and aborts image loading when the QR changes or unmounts', async () => {
    const first = stage(), second = stage(); create.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const { rerender, unmount } = render(<MagicTreeStage imageUrl="blob:first" />);
    await screen.findByRole('button', { name: '俯视查看二维码' });
    const signal = create.mock.calls[0][2] as AbortSignal;
    rerender(<MagicTreeStage imageUrl="blob:second" />);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(first.destroy).toHaveBeenCalledOnce(); expect(signal.aborted).toBe(true);
    await screen.findByRole('button', { name: '俯视查看二维码' });
    unmount(); expect(second.destroy).toHaveBeenCalledOnce();
  });
  it('disposes initialization that resolves after unmount', async () => {
    const instance = stage(); let resolve!: (value: typeof instance) => void;
    create.mockReturnValue(new Promise(done => { resolve = done; }));
    const { unmount } = render(<MagicTreeStage imageUrl="blob:qr" />);
    unmount(); resolve(instance);
    await waitFor(() => expect(instance.destroy).toHaveBeenCalledOnce());
  });
  it('retries the same image after initialization failure or context loss', async () => {
    const instance = stage();
    create.mockRejectedValueOnce(new Error('WebGL unavailable')).mockResolvedValue(instance);
    render(<MagicTreeStage imageUrl="blob:qr" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('树景加载失败');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新加载树景' }));
    await screen.findByRole('button', { name: '俯视查看二维码' });
    expect(create.mock.calls[1][1]).toBe('blob:qr');
    const { act } = await import('@testing-library/react');
    act(() => create.mock.calls[1][3]());
    expect(screen.getByRole('alert')).toBeVisible();
    expect(instance.destroy).toHaveBeenCalled();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
