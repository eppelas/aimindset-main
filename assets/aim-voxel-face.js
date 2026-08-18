const DEFAULT_IMAGE_SRC = "";
function roundedRect(context, x, y, width, height, radius) {
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
}
function getIntroPosition(homeX, homeY, drawX, drawY, drawSize) {
    const centerX = drawX + drawSize / 2;
    const centerY = drawY + drawSize / 2;
    const angle = Math.random() * Math.PI * 2;
    const radius = drawSize * (0.72 + Math.random() * 0.22);
    return { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
}
function mountAimVoxelFace(host, { imageSrc = DEFAULT_IMAGE_SRC, scale = 1, opacity = 1 } = {}) {
    if (!(host instanceof HTMLElement))
        throw new TypeError("mountAimVoxelFace needs an element host");
    if (!imageSrc)
        throw new Error("mountAimVoxelFace needs imageSrc");
    const pointerRef = { current: { x: -9999, y: -9999 } };
    const scrollRef = { current: 0 };
    const resetTimerRef = { current: null };
    const LOGO_SRC = imageSrc;
    host.style.aspectRatio = "1 / 1";
    host.style.display = "block";
    host.style.opacity = String(opacity);
    host.style.transform = scale === 1 ? "" : `scale(${scale})`;
    const canvas = host.querySelector("canvas") || host.appendChild(document.createElement("canvas"));
    if (!canvas)
        return;
    const context = canvas.getContext('2d');
    if (!context)
        return;
    const internalSize = 680;
    const drawSize = 560;
    const drawX = (internalSize - drawSize) / 2;
    const drawY = (internalSize - drawSize) / 2;
    const cellSize = 8;
    const gap = 1;
    const step = cellSize + gap;
    const seamInset = 6;
    const seamX = drawX + drawSize / 2;
    const rightHalfStart = seamX - cellSize - seamInset;
    const repulsionRadius = 112;
    const edgeRadius = Math.max(1.6, cellSize * 0.2);
    const scrollAmplitude = 0;
    const introSpeed = 0.0036;
    const rightHalfYOffset = -3.5;
    canvas.width = internalSize;
    canvas.height = internalSize;
    const image = new Image();
    const offscreen = document.createElement('canvas');
    offscreen.width = internalSize;
    offscreen.height = internalSize;
    const offscreenContext = offscreen.getContext('2d', { willReadFrequently: true });
    const leftMaskCanvas = document.createElement('canvas');
    leftMaskCanvas.width = internalSize;
    leftMaskCanvas.height = internalSize;
    const leftMaskContext = leftMaskCanvas.getContext('2d');
    let frameId = 0;
    let disposed = false;
    let introProgress = 0;
    let voxels = [];
    let lastScrollY = window.scrollY;
    let scrollVelocity = 0;
    const setPointerFromEvent = (event) => {
        const rect = canvas.getBoundingClientRect();
        pointerRef.current = {
            x: ((event.clientX - rect.left) / rect.width) * internalSize,
            y: ((event.clientY - rect.top) / rect.height) * internalSize,
        };
    };
    const clearResetTimer = () => {
        if (resetTimerRef.current !== null) {
            window.clearTimeout(resetTimerRef.current);
            resetTimerRef.current = null;
        }
    };
    const onPointerMove = (event) => {
        clearResetTimer();
        setPointerFromEvent(event);
    };
    const onPointerDown = (event) => {
        clearResetTimer();
        setPointerFromEvent(event);
    };
    const onPointerLeave = () => {
        pointerRef.current = { x: -9999, y: -9999 };
    };
    const onPointerUp = () => {
        clearResetTimer();
        resetTimerRef.current = window.setTimeout(() => {
            pointerRef.current = { x: -9999, y: -9999 };
            resetTimerRef.current = null;
        }, 420);
    };
    const onScroll = () => {
        scrollRef.current = window.scrollY;
    };
    const isInsideEyeZone = (x, y, padding = 0) => {
        const normalizedX = (x - drawX) / drawSize;
        const normalizedY = (y - drawY) / drawSize;
        const left = 0.625 - padding;
        const right = 0.89 + padding;
        const topBound = 0.435 - padding;
        const bottomBound = 0.595 + padding;
        if (normalizedX < left || normalizedX > right || normalizedY < topBound || normalizedY > bottomBound) {
            return false;
        }
        const t = (normalizedX - left) / Math.max(0.001, right - left);
        const topLineY = 0.482 - t * 0.004 - padding * 0.2;
        const ellipseCenterX = 0.756;
        const ellipseCenterY = 0.505 + padding * 0.04;
        const radiusX = 0.13 + padding * 1.0;
        const radiusY = 0.061 + padding * 0.7;
        const ellipseValue = ((normalizedX - ellipseCenterX) / radiusX) * ((normalizedX - ellipseCenterX) / radiusX) +
            ((normalizedY - ellipseCenterY) / radiusY) * ((normalizedY - ellipseCenterY) / radiusY);
        const insideMainEye = normalizedY >= topLineY && ellipseValue <= 1;
        const fillTopGap = normalizedX > 0.83 - padding && normalizedX < 0.865 + padding && normalizedY < 0.49;
        const trimLowerLeftA = normalizedX > 0.64 - padding &&
            normalizedX < 0.69 + padding &&
            normalizedY > 0.52 - padding &&
            normalizedY < 0.545 + padding;
        const trimLowerLeftB = normalizedX > 0.69 - padding &&
            normalizedX < 0.72 + padding &&
            normalizedY > 0.535 - padding &&
            normalizedY < 0.56 + padding;
        return (insideMainEye && !fillTopGap) || trimLowerLeftA || trimLowerLeftB;
    };
    const isInsideEyeContourZone = (x, y) => {
        return isInsideEyeZone(x, y, 0.02);
    };
    const getSeamShift = (x, _y) => {
        const contourProgress = Math.max(0, Math.min(1, (x - rightHalfStart) / Math.max(1, drawX + drawSize - rightHalfStart)));
        return 5 * Math.pow(1 - contourProgress, 1.75);
    };
    const getCoverage = (imageData, x, y) => {
        let brightHits = 0;
        let samples = 0;
        const sampleStep = Math.max(1, Math.floor(cellSize / 2));
        const endX = Math.min(internalSize - 1, x + cellSize);
        const endY = Math.min(internalSize - 1, y + cellSize);
        for (let sampleY = y; sampleY < endY; sampleY += sampleStep) {
            for (let sampleX = Math.max(x, Math.floor(seamX) + 1); sampleX < endX; sampleX += sampleStep) {
                const index = (sampleY * internalSize + sampleX) * 4;
                const r = imageData[index] ?? 0;
                const g = imageData[index + 1] ?? 0;
                const b = imageData[index + 2] ?? 0;
                const alpha = imageData[index + 3] ?? 0;
                const brightness = (r + g + b) / 3;
                samples += 1;
                if (alpha > 40 && brightness > 160)
                    brightHits += 1;
            }
        }
        return samples > 0 ? brightHits / samples : 0;
    };
    const getDarkCoverage = (imageData, x, y) => {
        const centerX = Math.max(0, Math.min(internalSize - 1, Math.round(x + cellSize * 0.5)));
        const centerY = Math.max(0, Math.min(internalSize - 1, Math.round(y + cellSize * 0.5)));
        let darkHits = 0;
        let samples = 0;
        for (let offsetY = -6; offsetY <= 6; offsetY += 2) {
            for (let offsetX = -7; offsetX <= 7; offsetX += 2) {
                const sampleX = Math.max(0, Math.min(internalSize - 1, centerX + offsetX));
                const sampleY = Math.max(0, Math.min(internalSize - 1, centerY + offsetY));
                const index = (sampleY * internalSize + sampleX) * 4;
                const r = imageData[index] ?? 0;
                const g = imageData[index + 1] ?? 0;
                const b = imageData[index + 2] ?? 0;
                const alpha = imageData[index + 3] ?? 0;
                const brightness = (r + g + b) / 3;
                samples += 1;
                if (alpha > 40 && brightness < 96)
                    darkHits += 1;
            }
        }
        return samples > 0 ? darkHits / samples : 0;
    };
    const buildLeftMask = (imageData) => {
        if (!leftMaskContext)
            return;
        const maskImage = leftMaskContext.createImageData(internalSize, internalSize);
        for (let y = 0; y < internalSize; y += 1) {
            for (let x = 0; x < internalSize; x += 1) {
                const index = (y * internalSize + x) * 4;
                const r = imageData[index] ?? 0;
                const g = imageData[index + 1] ?? 0;
                const b = imageData[index + 2] ?? 0;
                const alpha = imageData[index + 3] ?? 0;
                const brightness = (r + g + b) / 3;
                const isLogoPixel = x < seamX && alpha > 40 && brightness > 160;
                maskImage.data[index] = 24;
                maskImage.data[index + 1] = 22;
                maskImage.data[index + 2] = 22;
                maskImage.data[index + 3] = isLogoPixel ? 255 : 0;
            }
        }
        leftMaskContext.clearRect(0, 0, internalSize, internalSize);
        leftMaskContext.putImageData(maskImage, 0, 0);
    };
    const buildVoxels = (imageData) => {
        const candidates = [];
        const manualEyeVoidKeys = new Set([
            '14,31',
            '11,32',
            '10,33',
            '7,33',
            '10,32',
            '9,32',
        ]);
        const manualEyeFillKeys = new Set([
            '11,31',
            '12,31',
            '13,31',
            '7,34',
            '16,30',
            '16,31',
            '17,30',
            '17,31',
            '18,30',
            '18,31',
            '18,32',
            '18,33',
            '18,34',
        ]);
        for (let row = 0, y = drawY; y < drawY + drawSize; y += step, row += 1) {
            for (let column = 0, x = rightHalfStart; x < drawX + drawSize; x += step, column += 1) {
                const normalizedX = (x - drawX) / drawSize;
                const normalizedY = (y - drawY) / drawSize;
                const coverage = getCoverage(imageData, x, y);
                const nearSeam = x < drawX + drawSize / 2 + step * 2;
                const nearTail = y > drawY + drawSize * 0.78;
                const nearOuter = normalizedX > 0.82;
                const nearTopCurve = normalizedX > 0.7 && normalizedY < 0.24;
                const nearEyeContour = false;
                const cellKey = `${column},${row}`;
                const manualVoid = manualEyeVoidKeys.has(cellKey);
                const manualFill = manualEyeFillKeys.has(cellKey);
                const sampledEye = isInsideEyeZone(x + cellSize * 0.5, y + cellSize * 0.5) &&
                    getDarkCoverage(imageData, x, y) > 0.18;
                const insideEye = manualVoid || (sampledEye && !manualFill);
                const preserveDensity = nearSeam || nearTail || nearOuter || nearTopCurve;
                let threshold = 0.15;
                if (nearOuter || nearTopCurve)
                    threshold = 0.012;
                else if (preserveDensity)
                    threshold = 0.018;
                candidates.push({
                    x,
                    y,
                    shouldFill: manualFill || (coverage > threshold && !insideEye),
                    insideEye,
                    nearSeam,
                    nearTail,
                    nearOuter,
                    nearTopCurve,
                    nearEyeContour,
                    coverage,
                });
            }
        }
        const columns = Math.ceil((drawX + drawSize - rightHalfStart) / step);
        const rows = Math.ceil(drawSize / step);
        const isFilled = new Set();
        candidates.forEach((candidate, index) => {
            if (candidate.shouldFill)
                isFilled.add(index);
        });
        const getIndex = (column, row) => row * columns + column;
        const isFilledAt = (column, row) => {
            if (column < 0 || row < 0 || column >= columns || row >= rows)
                return false;
            return isFilled.has(getIndex(column, row));
        };
        const countNeighbors = (column, row) => {
            let count = 0;
            for (let deltaY = -1; deltaY <= 1; deltaY += 1) {
                for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
                    if (deltaX === 0 && deltaY === 0)
                        continue;
                    const neighborColumn = column + deltaX;
                    const neighborRow = row + deltaY;
                    if (neighborColumn < 0 || neighborRow < 0 || neighborColumn >= columns || neighborRow >= rows)
                        continue;
                    if (isFilled.has(getIndex(neighborColumn, neighborRow)))
                        count += 1;
                }
            }
            return count;
        };
        for (let pass = 0; pass < 3; pass += 1) {
            candidates.forEach((candidate, index) => {
                if (isFilled.has(index) || candidate.insideEye)
                    return;
                const column = index % columns;
                const row = Math.floor(index / columns);
                const neighborCount = countNeighbors(column, row);
                const up = isFilledAt(column, row - 1);
                const down = isFilledAt(column, row + 1);
                const left = isFilledAt(column - 1, row);
                const right = isFilledAt(column + 1, row);
                const upLeft = isFilledAt(column - 1, row - 1);
                const downLeft = isFilledAt(column - 1, row + 1);
                const closesVerticalGap = up && down && (left || right);
                const closesHorizontalGap = left && right && (up || down);
                const closesOuterGap = (candidate.nearOuter || candidate.nearTopCurve) && neighborCount >= 4;
                const closesOuterStepGap = candidate.nearOuter && left && (up || down);
                const closesOuterColumnGap = candidate.nearOuter && up && down;
                const closesOuterDiagonalGap = candidate.nearOuter && left && (upLeft || downLeft);
                const canCloseHole = candidate.coverage > 0.006 ||
                    candidate.nearSeam ||
                    candidate.nearTail ||
                    candidate.nearOuter ||
                    candidate.nearTopCurve;
                if (closesVerticalGap ||
                    closesHorizontalGap ||
                    closesOuterGap ||
                    closesOuterStepGap ||
                    closesOuterColumnGap ||
                    closesOuterDiagonalGap ||
                    (neighborCount >= 5 && canCloseHole)) {
                    isFilled.add(index);
                }
            });
        }
        voxels = candidates.flatMap((candidate, index) => {
            if (!isFilled.has(index))
                return [];
            const adjustedY = candidate.y + rightHalfYOffset;
            const introPosition = getIntroPosition(candidate.x, adjustedY, drawX, drawY, drawSize);
            return [{
                    homeX: candidate.x - getSeamShift(candidate.x, candidate.y),
                    homeY: adjustedY,
                    x: introPosition.x,
                    y: introPosition.y,
                    vx: 0,
                    vy: 0,
                    firmness: 0.06 + Math.random() * 0.024,
                    size: cellSize,
                    phase: Math.random() * Math.PI * 2,
                    drift: 0.45 + Math.random() * 0.75,
                }];
        });
    };
    // Видимость canvas — пропускаем отрисовку когда за пределами viewport
    let isVisible = true;
    const observer = new IntersectionObserver(([entry]) => { isVisible = entry.isIntersecting; }, { threshold: 0 });
    observer.observe(canvas);
    const draw = () => {
        if (disposed)
            return;
        // Не рисуем когда canvas не видим — экономим GPU/CPU
        if (!isVisible) {
            frameId = window.requestAnimationFrame(draw);
            return;
        }
        introProgress = Math.min(1, introProgress + introSpeed);
        context.clearRect(0, 0, internalSize, internalSize);
        if (leftMaskContext) {
            context.drawImage(leftMaskCanvas, 0, 0);
        }
        context.fillStyle = '#181616';
        context.shadowColor = 'rgba(24, 22, 22, 0.08)';
        context.shadowBlur = 0.8;
        context.beginPath();
        const currentScrollY = scrollRef.current;
        scrollVelocity += (Math.abs(currentScrollY - lastScrollY) - scrollVelocity) * 0.15;
        lastScrollY = currentScrollY;
        const currentScrollAmplitude = scrollAmplitude + scrollVelocity * 2.5;
        for (const voxel of voxels) {
            const anchorX = voxel.homeX + voxel.size * 0.5;
            const anchorY = voxel.homeY + voxel.size * 0.5;
            const dx = anchorX - pointerRef.current.x;
            const dy = anchorY - pointerRef.current.y;
            const distance = Math.hypot(dx, dy) || 1;
            if (distance < repulsionRadius) {
                const force = (1 - distance / repulsionRadius) * 2.2;
                voxel.vx += (dx / distance) * force;
                voxel.vy += (dy / distance) * force;
            }
            const scrollWave = currentScrollAmplitude
                ? Math.sin(scrollRef.current * 0.012 + voxel.phase + voxel.homeY * 0.016) *
                    currentScrollAmplitude *
                    voxel.drift
                : 0;
            const targetX = voxel.homeX + scrollWave * 0.45;
            const targetY = voxel.homeY + scrollWave * 0.18;
            const introPull = 0.72 - introProgress * 0.72;
            voxel.vx += (targetX - voxel.x) * (voxel.firmness + introPull * 0.02);
            voxel.vy += (targetY - voxel.y) * (voxel.firmness + introPull * 0.02);
            voxel.vx *= 0.84;
            voxel.vy *= 0.84;
            voxel.x += voxel.vx;
            voxel.y += voxel.vy;
            roundedRect(context, voxel.x, voxel.y, voxel.size, voxel.size, edgeRadius);
        }
        context.fill();
        context.shadowBlur = 0;
        frameId = window.requestAnimationFrame(draw);
    };
    image.onload = () => {
        if (!offscreenContext || disposed)
            return;
        offscreenContext.clearRect(0, 0, internalSize, internalSize);
        offscreenContext.drawImage(image, drawX, drawY, drawSize, drawSize);
        const imageData = offscreenContext.getImageData(0, 0, internalSize, internalSize).data;
        buildLeftMask(imageData);
        buildVoxels(imageData);
        draw();
    };
    image.src = LOGO_SRC;
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
        disposed = true;
        clearResetTimer();
        observer.disconnect();
        window.cancelAnimationFrame(frameId);
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerleave', onPointerLeave);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
        window.removeEventListener('scroll', onScroll);
    };
}
if (typeof window !== "undefined")
    window.AIMVoxelFace = { mount: mountAimVoxelFace };
