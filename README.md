# Ant Extension for Panic's Nova

Extension for running [Apache Ant](https://ant.apache.org/) builds from a sidebar in [Panic's Nova](https://nova.app/)

# Notes

Currently, very limitted functionallity. Does not like empty <target> tags! It uses a modified version of [alabianca/xml-to-json](https://github.com/alabianca/xml-to-json) and a fix from [recalcitrantQ/xml-to-json](https://github.com/recalcitrantQ/xml-to-json/commits/master/) to handle the XML to JSON.
Which still has an error where if the first tag does not have content, it sometimes gets added as an empty element. Quick fix is just to include a
