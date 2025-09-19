const coordtransform = (function () {
  const x_pi = (3.14159265358979324 * 3000.0) / 180.0;
  const pi = 3.1415926535897932384626;
  const a = 6378245.0;
  const ee = 0.00669342162296594323;

  function transformlat(lng, lat) {
    let ret =
      -100.0 +
      2.0 * lng +
      3.0 * lat +
      0.2 * lat * lat +
      0.1 * lng * lat +
      0.2 * Math.sqrt(Math.abs(lng));
    ret +=
      ((20.0 * Math.sin(6.0 * lng * pi) + 20.0 * Math.sin(2.0 * lng * pi)) *
        2.0) /
      3.0;
    ret +=
      ((20.0 * Math.sin(lat * pi) + 40.0 * Math.sin((lat / 3.0) * pi)) * 2.0) /
      3.0;
    ret +=
      ((160.0 * Math.sin((lat / 12.0) * pi) +
        320 * Math.sin((lat * pi) / 30.0)) *
        2.0) /
      3.0;
    return ret;
  }

  function transformlng(lng, lat) {
    let ret =
      300.0 +
      lng +
      2.0 * lat +
      0.1 * lng * lng +
      0.1 * lng * lat +
      0.1 * Math.sqrt(Math.abs(lng));
    ret +=
      ((20.0 * Math.sin(6.0 * lng * pi) + 20.0 * Math.sin(2.0 * lng * pi)) *
        2.0) /
      3.0;
    ret +=
      ((20.0 * Math.sin(lng * pi) + 40.0 * Math.sin((lng / 3.0) * pi)) * 2.0) /
      3.0;
    ret +=
      ((150.0 * Math.sin((lng / 12.0) * pi) +
        300.0 * Math.sin((lng / 30.0) * pi)) *
        2.0) /
      3.0;
    return ret;
  }

  function out_of_china(lng, lat) {
    return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
  }

  return {
    wgs84togcj02: function (lng, lat) {
      if (out_of_china(lng, lat)) {
        return [lng, lat];
      } else {
        let dlat = transformlat(lng - 105.0, lat - 35.0);
        let dlng = transformlng(lng - 105.0, lat - 35.0);
        const radlat = (lat / 180.0) * pi;
        let magic = Math.sin(radlat);
        magic = 1 - ee * magic * magic;
        const sqrtmagic = Math.sqrt(magic);
        dlat = (dlat * 180.0) / (((a * (1 - ee)) / (magic * sqrtmagic)) * pi);
        dlng = (dlng * 180.0) / ((a / sqrtmagic) * Math.cos(radlat) * pi);
        const mglat = lat + dlat;
        const mglng = lng + dlng;
        return [mglng, mglat];
      }
    },
  };
})();