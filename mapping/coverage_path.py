def generate_lawnmower_path(lat_start, lon_start, rows, cols, step):

    path = []

    for r in range(rows):

        if r % 2 == 0:
            col_range = range(cols)
        else:
            col_range = reversed(range(cols))

        for c in col_range:

            lat = lat_start + (r * step)
            lon = lon_start + (c * step)

            path.append((lat, lon))

    return path


if __name__ == "__main__":

    path = generate_lawnmower_path(
        lat_start=12.9715,
        lon_start=77.5941,
        rows=4,
        cols=4,
        step=0.0001
    )

    for p in path:
        print(p)