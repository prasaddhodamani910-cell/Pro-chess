import cv2
import os
import shutil

img = cv2.imread("assets/screenshots/board_lichess.png")
H, W = img.shape[:2]

gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
edges = cv2.Canny(gray, 50, 150)
edges = cv2.dilate(edges, None, iterations=2)

contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

best, best_area = None, 0
for cnt in contours:
    x, y, w, h = cv2.boundingRect(cnt)
    squareish = 0.95 < w / h < 1.05
    big = w > W * 0.5
    if squareish and big and w * h > best_area:
        best, best_area = (x, y, w, h), w * h

if best is None:
    print("Board not found, use manual X/Y/SIZE")
    raise SystemExit

x, y, w, h = best
size = min(w, h)
board = img[y:y+size, x:x+size]
print("Found board at", x, y, "size", size)
cv2.imwrite("output/preview.png", board)

if os.path.exists("output/squares"):
    shutil.rmtree("output/squares")
os.makedirs("output/squares", exist_ok=True)

step = size // 8
for r in range(8):
    for c in range(8):
        sq = board[r*step:(r+1)*step, c*step:(c+1)*step]
        cv2.imwrite(f"output/squares/{r}{c}.png", sq)
print("Saved 64 squares")