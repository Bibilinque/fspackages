/**
 * A collection of road data.
 */
class WT_MapViewRoadData {
    constructor(regions, types) {
        this._regions = regions;
        this._types = types;
        this._rawData = [];
        this._features = [];
        this._bvh = [];
        this._bvhLoadCount = 0;
        this._lodDataLoadCount = 0;
        this._isReady = false;
        this._initArrays();
        this._openFiles();

        this._tempBoundingBox = [[0, 0, 0], [0, 0, 0]];
        this._tempVector = new WT_GVector3(0, 0, 0);
        this._tempNM = new WT_NumberUnit(0, WT_Unit.NMILE);
    }

    _initArrays() {
        for (let region of this._regions) {
            this._rawData[region] = [];
            this._features[region] = [];
            this._bvh[region] = [];
            for (let type of this._types) {
                this._rawData[region][type] = [];
                this._features[region][type] = [];
            }
        }
    }

    /**
     * Checks whether the border data has been loaded and processed.
     * @returns {Boolean} whether the border data has been loaded and processed.
     */
    isReady() {
        return this._isReady;
    }

    _checkReady() {
        let total = this._regions.length * this._types.length;
        if (this._bvhLoadCount === total && this._lodDataLoadCount === total * WT_MapViewRoadData.LOD_COUNT) {
            this._isReady = true;
        }
    }

    _loadLODData(region, type, lod, data) {
        this._rawData[region][type][lod] = JSON.parse(data);
        this._features[region][type][lod] = [];
        this._lodDataLoadCount++;
        this._checkReady();
    }

    _loadBVHData(region, type, data) {
        this._bvh[region][type] = JSON.parse(data);
        this._bvhLoadCount++;
        this._checkReady();
    }

    async _onZipOpened(region, type, entries) {
        let fileRoot = `${WT_MapViewRoadData.DATA_FILE_REGION_STRING[region]}_${WT_MapViewRoadData.DATA_FILE_TYPE_STRING[type]}`;

        for (let i = 0; i < WT_MapViewRoadData.LOD_COUNT; i++) {
            let fileName = `${fileRoot}_lod${i}.json`;
            let entry = entries.find(e => e.filename === fileName);
            let data = await entry.getData(new zip.TextWriter());
            this._loadLODData(region, type, i, data);
        }

        let fileName = `${fileRoot}_bvh.json`;
        let entry = entries.find(e => e.filename === fileName);
        let data = await entry.getData(new zip.TextWriter());
        this._loadBVHData(region, type, data);
    }

    _openZipForType(dir, region, type) {
        let path = `${dir}/${WT_MapViewRoadData.DATA_FILE_REGION_STRING[region]}_${WT_MapViewRoadData.DATA_FILE_TYPE_STRING[type]}.zip`;
        let request = new XMLHttpRequest();
        request.responseType = "arraybuffer";

        request.addEventListener("load",
            (async function() {
                let zipReader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(request.response)));
                let entries = await zipReader.getEntries();
                this._onZipOpened(region, type, entries);
            }).bind(this)
        );
        request.open("GET", path);
        request.send();
    }

    _openZipsForRegion(region) {
        let dir = `${WT_MapViewRoadData.DATA_FILE_DIR}/${WT_MapViewRoadData.DATA_FILE_REGION_STRING[region]}`;
        for (let type of this._types) {
            this._openZipForType(dir, region, type);
        }
    }

    _openZips() {
        for (let region of this._regions) {
            this._openZipsForRegion(region);
        }
    }

    _openFile(path, loadFunc) {
        return new Promise(resolve => {
            let request = new XMLHttpRequest();
            request.overrideMimeType("application/json");

            request.addEventListener("load",
                function() {
                    loadFunc(request.responseText);
                    resolve();
                }
            );
            request.open("GET", path);
            request.send();
        });
    }

    async _openFilesForType(dir, region, type) {
        let file = `${WT_MapViewRoadData.DATA_FILE_REGION_STRING[region]}_${WT_MapViewRoadData.DATA_FILE_TYPE_STRING[type]}`;

        for (let i = 0; i < WT_MapViewRoadData.LOD_COUNT; i++) {
            await this._openFile(`${dir}/${file}_lod${i}.json`, this._loadLODData.bind(this, region, type, i));
        }

        this._openFile(`${dir}/${file}_${WT_MapViewRoadData.DATA_FILE_BVH_STRING}.json`, this._loadBVHData.bind(this, region, type));
    }

    async _openFilesForRegion(region) {
        let dir = `${WT_MapViewRoadData.DATA_FILE_DIR}/${WT_MapViewRoadData.DATA_FILE_REGION_STRING[region]}`;
        for (let type of this._types) {
            await this._openFilesForType(dir, region, type);
        }
    }

    _openFiles() {
        for (let region of this._regions) {
            this._openFilesForRegion(region);
        }
    }

    /**
     * Checks whether this collection contains data for a specific region.
     * @param {WT_MapViewRoadData.Region} region - the region to check.
     * @returns {Boolean} whether this collection contains data for the region.
     */
    hasRegion(region) {
        return this._regions.indexOf(region) >= 0;
    }

    /**
     * Checks whether this collection contains data for a specific road type.
     * @param {WT_MapViewRoadData.Type} type - the road type to check.
     * @returns {Boolean} whether this collection contains data for the road type.
     */
    hasType(type) {
        return this._types.indexOf(type) >= 0;
    }

    /**
     * Counts the number of LOD levels encoded in this collection.
     * @returns {Number} the number of LOD levels encoded in this collection.
     */
    countLODLevels() {
        if (!this.isReady()){
            return undefined;
        }
        return this._rawData.length;
    }

    /**
     *
     * @param {String[]} rawData
     * @param {WT_MapViewRoadFeature[]} features
     * @param {Number} index
     * @returns {WT_MapViewRoadFeature}
     */
    _getFeature(rawData, features, index) {
        let feature = features[index];
        if (!feature) {
            feature = JSON.parse(rawData.features[index]);
            features[index] = feature;
            rawData.features[index] = null;
        }
        return feature;
    }

    _doesIntersect(center, radius, bbox) {
        let x = Math.max(bbox[0][0], Math.min(center.x, bbox[1][0]));
        let y = Math.max(bbox[0][1], Math.min(center.y, bbox[1][1]));
        let z = Math.max(bbox[0][2], Math.min(center.z, bbox[1][2]));

        let dx = x - center.x;
        let dy = y - center.y;
        let dz = z - center.z;
        return dx * dx + dy * dy + dz * dz < radius * radius;
    }

    /**
     *
     * @param {WT_MapViewRoadFeature[]} array
     * @param {WT_MapViewRoadFeature} feature
     * @param {WT_GeoPoint} center
     */
    _insertInOrder(array, feature, center) {
        let low = 0;
        let high = array.length;
        let target = 0;

        let distance = center.distance(feature.properties.centroid[1], feature.properties.centroid[0]);
        while (high > low) {
            target = Math.floor((low + high) / 2);
            let comparison = array[target];
            let compareDistance = center.distance(comparison.properties.centroid[1], comparison.properties.centroid[0]);
            if (distance < compareDistance) {
                high = target;
            } else if (distance > compareDistance) {
                low = target + 1;
            } else {
                break;
            }
        }
        array.splice(target, 0, feature);
    }

    /**
     *
     * @param {String[]} rawData
     * @param {WT_MapViewRoadFeature[]} features
     * @param {WT_GeoPoint} center
     * @param {WT_GVector3} centerCartesian
     * @param {Number} radius
     * @param {WT_NumberUnit} minLength
     * @param {WT_MapViewRoadFeature[]} results
     * @param {Object} node
     */
    _searchBVHHelper(rawData, features, center, centerCartesian, radius, minLength, results, node) {
        if (this._doesIntersect(centerCartesian, radius, node.bbox)) {
            if (node.featureIndex !== undefined) {
                let feature = this._getFeature(rawData, features, node.featureIndex);
                if (minLength.compare(feature.properties.length) <= 0) {
                    this._insertInOrder(results, feature, center);
                }
            } else {
                this._searchBVHHelper(rawData, features, center, centerCartesian, radius, minLength, results, node.left);
                this._searchBVHHelper(rawData, features, center, centerCartesian, radius, minLength, results, node.right);
            }
        }
    }

    /**
     *
     * @param {String[]} rawData
     * @param {WT_MapViewRoadFeature[]} features
     * @param {WT_GeoPoint} center
     * @param {Number} radius
     * @param {WT_NumberUnit} minLength
     * @param {WT_MapViewRoadFeature[]} results
     */
    _searchBVH(region, type, lod, center, radius, minLength, results) {
        let centerCartesian = center.cartesian(this._tempVector);
        let rawData = this._rawData[region][type][lod];
        let features = this._features[region][type][lod];
        this._searchBVHHelper(rawData, features, center, centerCartesian, radius.asUnit(WT_Unit.GA_RADIAN), minLength, results, this._bvh[region][type]);
    }

    /**
     * Gets all road features located within a circular area.
     * @param {WT_MapViewRoadData.Type} type - the type of road feature for which to search.
     * @param {Number} lod - an LOD level.
     * @param {WT_GeoPoint} center - the center of the area to search.
     * @param {WT_NumberUnit} radius - the radius of the area to search.
     * @param {WT_NumberUnit} [minLength] - if this argument is supplied, enforces a minimum length on the road features
     *                                      returned by the search.
     * @returns {WT_MapViewRoadFeature[]} an array of feature border data.
     */
    searchFeatures(type, lod, center, radius, minLength) {
        if (!this.isReady()) {
            return undefined;
        }

        if (minLength) {
            this._tempNM.set(minLength);
        } else {
            this._tempNM.set(0);
        }

        let results = [];
        if (this.hasType(type)) {
            for (let region of this._regions) {
                this._searchBVH(region, type, lod, center, radius, this._tempNM, results);
            }
        }
        return results;
    }
}
/**
 * @enum {Number}
 */
WT_MapViewRoadData.Region = {
    NA: 0,
    SA: 1,
    EI: 2,
    EN: 3,
    EW: 4,
    EC: 5,
    EE: 6,
    AF: 7,
    CA: 8,
    EA: 9,
    OC: 10
};
/**
 * @enum {Number}
 */
WT_MapViewRoadData.Type = {
    HIGHWAY: 0,
    PRIMARY: 1
}
WT_MapViewRoadData.LOD_COUNT = 4;
WT_MapViewRoadData.DATA_FILE_DIR = "/WTg3000/SDK/Assets/Data/Roads";
WT_MapViewRoadData.DATA_FILE_REGION_STRING = [
    "NA",
    "SA",
    "EI",
    "EN",
    "EW",
    "EC",
    "EE",
    "AF",
    "CA",
    "EA",
    "OC"
];
WT_MapViewRoadData.DATA_FILE_TYPE_STRING = [
    "highway",
    "primary"
];
WT_MapViewRoadData.DATA_FILE_BVH_STRING = "bvh";

/**
 * @typedef WT_MapViewRoadFeature
 * @property {String} type
 * @property {{type:WT_MapViewRoadData.Type, country:Number, surface:Number, centroid:Number[], length:Number}} properties
 * @property {{type:String, coordinates:Number[][][]}} geometry
 */