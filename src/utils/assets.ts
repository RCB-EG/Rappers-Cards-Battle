
export const rarityBgUrls: Record<string, string> = {
    bronze: 'https://i.imghippo.com/files/TmM6820WtQ.png',
    silver: 'https://i.imghippo.com/files/zC9861peQ.png',
    gold: 'https://i.imghippo.com/files/tUt8745JBc.png',
    rotm: 'https://i.imghippo.com/files/UGRy5126YM.png',
    icon: 'https://i.imghippo.com/files/PjIu1716584980.png',
    legend: 'https://i.imghippo.com/files/jdCC2070F.png',
    event: 'https://i.imghippo.com/files/jdCC2070F.png'
};

export const packImageUrls = [
    'https://i.postimg.cc/R0sYyFhL/Free.png',
    'https://i.imghippo.com/files/KCG5562T.png',
    'https://i.postimg.cc/1z5Tv6mz/Builder.png',
    'https://i.postimg.cc/sxS0M4cT/Special.png',
    'https://i.postimg.cc/63Fm6md7/Legendary.png',
    'https://i.imghippo.com/files/cGUh9927EWc.png', // Player Pick / Generic
    'https://i.imghippo.com/files/osQP7559xUw.png', // Logo
    'https://i.imghippo.com/files/Exm8210UFo.png'   // Background
];

export const preloadCriticalAssets = async (): Promise<void> => {
    const urls = [
        ...Object.values(rarityBgUrls),
        ...packImageUrls
    ];

    const promises = urls.map(src => {
        return new Promise<void>((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = () => resolve();
            img.onerror = () => resolve(); // Resolve even on error to not block app
        });
    });

    await Promise.all(promises);
};
