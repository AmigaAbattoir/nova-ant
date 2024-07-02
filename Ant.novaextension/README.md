**Ant** provides sidebar integration to use **[Apache Ant](https://ant.apache.org/)** to allow you to launch build targets.

Included in the extensions is Apache Ant 1.10.14.

![](images/ant-screenshot.png)

Icons taken from Eclipse Ant.

## Requirements

Ant requires some additional tools to be installed on your Mac:

- Java 8 or newer

Make sure that `JAVA_HOME` has been set, and points to a JDK in you system. Otherwise, you may get errors if the build is using `javac`.

## Usage

To display the Ant sidebar:

- Click on the "All Sidebars" button.
- Select **Ant** or drag to a sidebar area

In the Ant sidebar, you can right-click and select "Run" on a target.

On targets and on other elements in the sidebar, you can also select "Show in Build XML" to jump to that point in the XML

## Configuration

To configure global preferences, open **Extensions → Extension Library...** then select Ant's **Preferences** tab.

You can also configure preferences on a per-project basis in **Project → Project Settings...**

The default it to look for a `build.xml` in the root of your Nova project.

## Notes

I made this extension to help my build some older projects. Many of them use simple XMLs for building and do not use any additional Ant libs, so your mileage will vary.
