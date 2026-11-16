import cv2
import os
import shutil

img = cv2.imread("assets/screenshots/board_lichess.png")
h, w = img.shape[:2]
print("Image size:", w, "x", h)

# Board position inside the screenshot (change these!)
X = 0       # pixels from the left edge to the board
Y = 634     # pixels from the top edge to the board
SIZE = w    # width of the board (it is a square)

board = img[Y:Y+SIZE, X:X+SIZE]
cv2.imwrite("output/preview.png", board)

# Delete old squares so the count is always 64
if os.path.exists("output/squares"):
    shutil.rmtree("output/squares")
os.makedirs("output/squares", exist_ok=True)

step = SIZE // 8
for r in range(8):
    for c in range(8):
        sq = board[r*step:(r+1)*step, c*step:(c+1)*step]
        cv2.imwrite(f"output/squares/{r}{c}.png", sq)

print("Saved 64 squares")