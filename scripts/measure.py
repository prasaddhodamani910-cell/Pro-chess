import cv2, sys

img = cv2.imread(sys.argv[1])
H, W = img.shape[:2]
print("Image size:", W, "x", H)

# Part 1: try to find the board automatically
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
edges = cv2.dilate(cv2.Canny(gray, 50, 150), None, iterations=2)
cnts, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
best, area = None, 0
for c in cnts:
    x, y, w, h = cv2.boundingRect(c)
    if 0.9 < w / h < 1.1 and w > W * 0.5 and w * h > area:
        best, area = (x, y, w, h), w * h
if best:
    x, y, w, h = best
    s = min(w, h)
    print(f"Try: crop={x},{y},{s}")
    cv2.imwrite("output/measure_preview.png", img[y:y+s, x:x+s])
else:
    print("Auto-find failed, use the grid image")

# Part 2: draw a ruler grid so you can read the numbers yourself
g = img.copy()
for v in range(0, W, 100):
    cv2.line(g, (v, 0), (v, H), (0, 0, 255), 2)
    cv2.putText(g, str(v), (v + 4, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 2)
for v in range(0, H, 100):
    cv2.line(g, (0, v), (W, v), (255, 0, 0), 2)
    cv2.putText(g, str(v), (4, v - 6), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 0, 0), 2)
cv2.imwrite("output/grid.png", g)
print("Saved output/grid.png")