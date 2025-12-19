import React, { forwardRef, useEffect, useMemo, useRef, useState } from "react";

type Props = {
	src: string;
	alt?: string;
	className?: string;
	rootMargin?: string;
	threshold?: number | number[];
	eager?: boolean; // render immediately (useful for first page)
	fetchPriority?: "high" | "low" | "auto" | undefined;
	priority?: "high" | "low"; // internal queue priority
	onLoad?: () => void;
	onError?: (error: Error) => void;
	decodeBeforeDisplay?: boolean;
	onVisible?: () => void;
};

// tiny 1x1 transparent gif placeholder
const TRANSPARENT_PLACEHOLDER = "data:image/gif;base64,R0lGODlhAQABAIAAAP///////yH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";

type QueueTask<T> = {
	fn: () => Promise<T>;
	resolve: (value: T) => void;
	reject: (error: Error) => void;
	priority: number;
	cancelled: boolean;
};

class ImageDecodeQueue {
	private maxConcurrent: number;
	private active = 0;
	private queue: QueueTask<HTMLImageElement>[] = [];

	constructor(maxConcurrent = 2) {
		this.maxConcurrent = Math.max(1, maxConcurrent);
	}

	schedule(
		fn: () => Promise<HTMLImageElement>,
		options: { priority?: "high" | "low"; signal?: AbortSignal } = {},
	) {
		return new Promise<HTMLImageElement>((resolve, reject) => {
			const task: QueueTask<HTMLImageElement> = {
				fn,
				resolve,
				reject,
				priority: options.priority === "high" ? 0 : 1,
				cancelled: false,
			};

			if (options.signal) {
				if (options.signal.aborted) {
					task.cancelled = true;
					return reject(new DOMException("Aborted", "AbortError"));
				}
				options.signal.addEventListener(
					"abort",
					() => {
						task.cancelled = true;
						reject(new DOMException("Aborted", "AbortError"));
					},
					{ once: true },
				);
			}

			if (task.priority === 0) {
				this.queue.unshift(task);
			} else {
				this.queue.push(task);
			}
			this.drain();
		});
	}

	private drain() {
		if (this.active >= this.maxConcurrent) return;
		const next = this.queue.shift();
		if (!next) return;
		if (next.cancelled) {
			this.drain();
			return;
		}
		this.active += 1;
		next
			.fn()
			.then((value) => next.resolve(value))
			.catch((error) => next.reject(error instanceof Error ? error : new Error(String(error))))
			.finally(() => {
				this.active -= 1;
				this.drain();
			});
	}
}

const decodeQueue = new ImageDecodeQueue(5);


async function loadImageElement(
	url: string,
	options: { signal?: AbortSignal; decode?: boolean; priority?: "high" | "low" },
) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image();
		img.decoding = options.decode === false ? "auto" : "async";
		const loadStart = typeof performance !== "undefined" ? performance.now() : Date.now();
		const cleanup = () => {
			img.onload = null;
			img.onerror = null;
		};

		if (options.signal) {
			if (options.signal.aborted) {
				cleanup();
				return reject(new DOMException("Aborted", "AbortError"));
			}
			options.signal.addEventListener(
				"abort",
				() => {
					cleanup();
					try {
						img.src = TRANSPARENT_PLACEHOLDER;
					} catch {}
					reject(new DOMException("Aborted", "AbortError"));
				},
				{ once: true },
			);
		}

		img.onload = () => {
			cleanup();
			const loadEnd = typeof performance !== "undefined" ? performance.now() : Date.now();
			const loadMs = Math.max(0, loadEnd - loadStart);
			const prefix = `[LazyImage:${options.priority ?? "low"}]`;
			console.debug(`${prefix} loaded`, { url, loadMs: Math.round(loadMs * 100) / 100 });
			if (options.decode !== false && typeof img.decode === "function") {
				const decodeStart = typeof performance !== "undefined" ? performance.now() : Date.now();
				img
					.decode()
					.then(() => {
						const decodeMs = Math.max(0, (typeof performance !== "undefined" ? performance.now() : Date.now()) - decodeStart);
						console.debug(`${prefix} decoded`, { url, decodeMs: Math.round(decodeMs * 100) / 100 });
					})
					.catch((err) => {
						console.warn(`${prefix} decode failed`, err);
					});
			}
			resolve(img);
		};
		img.onerror = () => {
			cleanup();
			reject(new Error("Image failed to load"));
		};
		img.src = url;
	});
}

const LazyImage = forwardRef<HTMLImageElement, Props>(
	(
		{
			src,
			alt = "",
			className,
			rootMargin = "600px",
			threshold = 0,
			eager = false,
			fetchPriority,
			priority = "low",
			onLoad,
			onError,
			decodeBeforeDisplay = true,
			onVisible,
		},
		ref,
	) => {
		const imgRef = useRef<HTMLImageElement | null>(null);
		const combinedRef = (node: HTMLImageElement | null) => {
			imgRef.current = node;
			if (typeof ref === "function") ref(node);
			else if (ref && typeof ref === "object") (ref as any).current = node;
		};

		const [visible, setVisible] = useState<boolean>(Boolean(eager));
		const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">(eager ? "loading" : "idle");
		const [displaySrc, setDisplaySrc] = useState<string>(eager ? src : TRANSPARENT_PLACEHOLDER);
		const [retryToken, setRetryToken] = useState(0);
		const lastRequestedSrc = useRef<string | null>(null);

		useEffect(() => {
			setVisible(Boolean(eager));
			setStatus(eager ? "loading" : "idle");
			setDisplaySrc(eager ? src : TRANSPARENT_PLACEHOLDER);
			setRetryToken(0);
			lastRequestedSrc.current = null;
		}, [src, eager]);

		useEffect(() => {
			if (visible && onVisible) {
				onVisible();
			}
		}, [visible, onVisible]);

		useEffect(() => {
			if (visible) return;
			const el = imgRef.current;
			if (!el) return;
			if (typeof IntersectionObserver === "undefined") {
				setVisible(true);
				return;
			}
			const obs = new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						if (entry.isIntersecting) {
							setVisible(true);
							obs.disconnect();
							break;
						}
					}
				},
				{ root: null, rootMargin, threshold },
			);
			obs.observe(el);
			return () => obs.disconnect();
		}, [rootMargin, threshold, visible]);

		const effectivePriority = priority ?? (fetchPriority === "high" ? "high" : "low");
		const shouldLoad = visible || eager;
		const targetSrc = useMemo(() => src, [src]);

		useEffect(() => {
			if (!shouldLoad || !targetSrc) return;
			const controller = new AbortController();
			let cancelled = false;
			setStatus("loading");
			lastRequestedSrc.current = targetSrc;

			decodeQueue
				.schedule(
					() => loadImageElement(targetSrc, { signal: controller.signal, decode: decodeBeforeDisplay, priority: effectivePriority }),
					{ priority: effectivePriority, signal: controller.signal },
				)
				.then(() => {
					if (cancelled) return;
					setDisplaySrc(targetSrc);
					setStatus("loaded");
					try {
						onLoad && onLoad();
					} catch {}
				})
				.catch(async (error) => {
					if (cancelled || error.name === "AbortError") return;
					setStatus("error");
					setDisplaySrc(TRANSPARENT_PLACEHOLDER);
					try {
						onError && onError(error instanceof Error ? error : new Error(String(error)));
					} catch {}
				});

			return () => {
				cancelled = true;
				controller.abort();
			};
		}, [decodeBeforeDisplay, effectivePriority, retryToken, shouldLoad, targetSrc]);

		const handleRetry = () => {
			setStatus("idle");
			setDisplaySrc(TRANSPARENT_PLACEHOLDER);
			lastRequestedSrc.current = null;
			setRetryToken((t) => t + 1);
		};

		useEffect(() => {
			if (!shouldLoad || status !== "idle") return;
			lastRequestedSrc.current = targetSrc;
		}, [shouldLoad, status, targetSrc]);

		return (
			<div className="relative">
				<img
					ref={combinedRef}
					src={displaySrc}
					alt={alt}
					className={className}
					loading={eager ? "eager" : "lazy"}
					{...(fetchPriority ? ({ fetchpriority: fetchPriority } as any) : {})}
				/>
				{status === "error" && (
					<button
						type="button"
						onClick={handleRetry}
						className="absolute inset-1 flex items-center justify-center rounded-md border border-white/20 bg-black/70 px-4 py-2 text-sm font-semibold text-white shadow"
					>
						Không tải được ảnh – Thử lại
					</button>
				)}
			</div>
		);
	},
);

export default LazyImage;
