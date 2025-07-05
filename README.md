# not-so-lossy
A research project exploring distributed lossy image compression that preserves different details across multiple compressed versions, enabling high-quality reconstruction from the collective set.

## Research Focus
This project aims to demonstrate a novel approach to image compression where information loss is strategically distributed across multiple versions rather than uniformly applied. The goal is to develop proof-of-concept algorithms, create an interactive web demo, and publish the findings in an academic paper.

## Concept
Traditional lossy compression discards the same information across all compressed copies. This project implements a smart compression strategy where different devices/agents preserve different aspects of the original image. By combining multiple "differently-lossy" versions, we can reconstruct an image closer to the original than any single compressed version could provide.

## Use Case
When sharing photos across devices with storage constraints:
- Each device compresses to meet its storage limits
- Each compression preserves different image characteristics (edges, colors, textures, etc.)
- Original quality can be better approximated by combining all versions
- No single point of failure for image quality

## Social Recovery Mechanism
The system leverages social networks as a natural preservation layer:
- **Popularity = Preservation**: The more an image is viewed and liked, the more compressed versions exist across the network
- **Social Redundancy**: Viral images automatically gain more recovery points through natural sharing
- **Memory Augmentation**: Users can query their social network to find additional sources when trying to recover image details
- **Quality Correlation**: Image quality recovery potential correlates with its social engagement metrics
