const qualityColor = {
    0: '#B2B2B2', // Normal
    1: '#4D7455', // Genuine
    3: '#476291', // Vintage
    5: '#8650AC', // Unusual
    6: '#FFD700', // Unique
    7: '#70B04A', // Community
    8: '#A50F79', // Valve
    9: '#70B04A', //Self-Made
    11: '#CF6A32', //Strange
    13: '#38F3AB', //Haunted
    14: '#AA0000', //Collector's
    15: '#FAFAFA', // Decorated Weapon
};

function getQualityColor(quality) {
    return qualityColor[quality];
}

module.exports = getQualityColor;
