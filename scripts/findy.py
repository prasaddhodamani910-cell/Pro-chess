import cv2, sys

img = cv2.imread(sys.argv[1])
H, W = img.shape[:2]
print("Size:", W, "x", H)

for y in range(0, H - W + 1, 50):
    cv2.imwrite(f"output/try_{y}.png", img[y:y+W, 0:W])
    print("saved try_%d.png" % y)