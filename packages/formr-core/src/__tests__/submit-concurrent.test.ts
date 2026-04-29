import { describe, expect, it, vi } from "vitest";
import { createForm } from "../create-form.js";
import { FormrError } from "../errors.js";

describe("submit double-submit guard", () => {
  it("rejects concurrent submit with FORMR_SUBMIT_CONCURRENT error", async () => {
    let resolveSubmit!: (v: { ok: true; submitId: string }) => void;
    const onSubmit = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }),
    );

    const form = createForm({ onSubmit });

    // Start first submit (will hang on onSubmit)
    const first = form.submit();

    // Second submit should be rejected while first is running
    await expect(form.submit()).rejects.toThrow(FormrError);
    await expect(form.submit()).rejects.toThrow("already in progress");

    // Resolve first submit
    resolveSubmit({ ok: true, submitId: "test-id" });
    const result = await first;
    expect(result.ok).toBe(true);
  });

  it("rejected error has FORMR_SUBMIT_CONCURRENT code", async () => {
    let resolveSubmit!: (v: { ok: true; submitId: string }) => void;
    const onSubmit = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }),
    );

    const form = createForm({ onSubmit });
    const first = form.submit();

    try {
      await form.submit();
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(FormrError);
      expect((err as FormrError).code).toBe("FORMR_SUBMIT_CONCURRENT");
    }

    resolveSubmit({ ok: true, submitId: "done" });
    await first;
  });

  it("allows new submit after previous submit completes", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, submitId: "id" });
    const form = createForm({ onSubmit });

    const first = await form.submit();
    expect(first.ok).toBe(true);

    const second = await form.submit();
    expect(second.ok).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("allows new submit after previous submit fails", async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, submitId: "fail-id", message: "fail" })
      .mockResolvedValueOnce({ ok: true, submitId: "ok-id" });

    const form = createForm({ onSubmit });

    const first = await form.submit();
    expect(first.ok).toBe(false);

    const second = await form.submit();
    expect(second.ok).toBe(true);
  });
});
